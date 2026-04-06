from __future__ import annotations

import logging

from telova_api.config import Settings
from telova_api.integrations.contracts import IntegrationStatus
from telova_api.integrations.google_workspace import GoogleWorkspaceClientFactory
from telova_api.models import ContextPackage, Note, NoteType, ReplanEvent
from telova_api.repositories.notes import (
    ContextPackageRepository,
    NoteRepository,
    ReplanRepository,
)


logger = logging.getLogger(__name__)

KEEP_SCOPES = ["https://www.googleapis.com/auth/keep"]


class DatabaseNotesGateway:
    def __init__(
        self,
        note_repo: NoteRepository,
        context_repo: ContextPackageRepository,
        replan_repo: ReplanRepository,
    ) -> None:
        self.note_repo = note_repo
        self.context_repo = context_repo
        self.replan_repo = replan_repo

    async def create_context_package(
        self,
        *,
        user_id: str,
        goal_id: str | None,
        title: str,
        content: str,
        from_goal_id: str | None,
        to_goal_id: str | None,
        open_items: list[dict],
    ) -> tuple[Note, ContextPackage]:
        note = await self.note_repo.create_note(
            Note(
                user_id=user_id,
                goal_id=goal_id,
                title=title,
                content=content,
                note_type=NoteType.CONTEXT_PACKAGE.value,
                metadata_json={"from_goal_id": from_goal_id, "to_goal_id": to_goal_id},
            )
        )
        context_package = await self.context_repo.create(
            ContextPackage(
                user_id=user_id,
                from_goal_id=from_goal_id,
                to_goal_id=to_goal_id,
                note_id=note.id,
                summary=content,
                open_items=open_items,
            )
        )
        return note, context_package

    async def create_status_report(
        self,
        *,
        user_id: str,
        goal_id: str,
        title: str,
        content: str,
    ) -> Note:
        return await self.note_repo.create_note(
            Note(
                user_id=user_id,
                goal_id=goal_id,
                title=title,
                content=content,
                note_type=NoteType.STATUS_REPORT.value,
                metadata_json={},
            )
        )

    async def create_manual_note(
        self,
        *,
        user_id: str,
        title: str,
        content: str,
        goal_id: str | None = None,
        note_type: str = NoteType.MANUAL.value,
    ) -> Note:
        return await self.note_repo.create_note(
            Note(
                user_id=user_id,
                goal_id=goal_id,
                title=title,
                content=content,
                note_type=note_type,
                metadata_json={},
            )
        )

    async def update_note(
        self,
        note: Note,
        *,
        title: str | None = None,
        content: str | None = None,
    ) -> Note:
        if title is not None:
            note.title = title
        if content is not None:
            note.content = content
        return await self.note_repo.save(note)

    async def list_user_notes(self, user_id: str, limit: int = 50) -> list[Note]:
        return await self.note_repo.list_by_user(user_id, limit=limit)

    async def create_replan_event(self, event: ReplanEvent) -> ReplanEvent:
        return await self.replan_repo.create(event)

    async def describe_status(self, user_id: str) -> IntegrationStatus:
        del user_id
        return IntegrationStatus(
            name="Notes",
            kind="MCP tool",
            status="connected",
            detail="Using the local database-backed notes and memory adapter.",
            backend="database",
        )


class GoogleNotesGateway(DatabaseNotesGateway):
    def __init__(
        self,
        note_repo: NoteRepository,
        context_repo: ContextPackageRepository,
        replan_repo: ReplanRepository,
        *,
        workspace_factory: GoogleWorkspaceClientFactory,
        settings: Settings,
    ) -> None:
        super().__init__(note_repo, context_repo, replan_repo)
        self.workspace_factory = workspace_factory
        self.settings = settings

    async def create_context_package(self, **kwargs) -> tuple[Note, ContextPackage]:
        note, context_package = await super().create_context_package(**kwargs)
        await self._sync_note(note)
        return note, context_package

    async def create_status_report(self, **kwargs) -> Note:
        note = await super().create_status_report(**kwargs)
        await self._sync_note(note)
        return note

    async def create_manual_note(self, **kwargs) -> Note:
        note = await super().create_manual_note(**kwargs)
        await self._sync_note(note)
        return note

    async def update_note(
        self,
        note: Note,
        *,
        title: str | None = None,
        content: str | None = None,
    ) -> Note:
        updated = await super().update_note(note, title=title, content=content)
        await self._sync_note(updated, replace_existing=True)
        return updated

    async def list_user_notes(self, user_id: str, limit: int = 50) -> list[Note]:
        notes = await super().list_user_notes(user_id, limit=limit)
        if not (self.settings.google_keep_enabled and self.workspace_factory.is_configured()):
            return notes

        for note in notes:
            if not note.external_note_id:
                continue
            try:
                remote = await self.workspace_factory.execute(
                    user_id=user_id,
                    service_name="keep",
                    version="v1",
                    scopes=KEEP_SCOPES,
                    operation=lambda service: service.notes()
                    .get(name=note.external_note_id)
                    .execute(),
                )
            except Exception:
                logger.exception("Failed to refresh note %s from Google Keep.", note.id)
                continue

            note.title = remote.get("title") or note.title
            body = remote.get("body", {}).get("text", {}) or {}
            note.content = body.get("text") or note.content
            await self.note_repo.save(note)

        return await super().list_user_notes(user_id, limit=limit)

    async def describe_status(self, user_id: str) -> IntegrationStatus:
        del user_id
        if not self.settings.google_keep_enabled:
            return IntegrationStatus(
                name="Notes",
                kind="Google Keep",
                status="warning",
                detail=(
                    "Google backend is enabled, but Google Keep sync is disabled. "
                    "Notes remain in the local memory store."
                ),
                backend="google",
            )

        if not self.workspace_factory.is_configured():
            return IntegrationStatus(
                name="Notes",
                kind="Google Keep",
                status="warning",
                detail=(
                    "Google Keep sync is enabled, but Workspace credentials are "
                    "not configured. Notes are staying local."
                ),
                backend="google",
            )

        return IntegrationStatus(
            name="Notes",
            kind="Google Keep",
            status="connected",
            detail=(
                "Syncing Telova notes to Google Keep. Keep API support is "
                "intended for Google Workspace enterprise environments."
            ),
            backend="google",
        )

    async def _sync_note(
        self,
        note: Note,
        *,
        replace_existing: bool = False,
    ) -> None:
        if not (
            self.settings.google_keep_enabled and self.workspace_factory.is_configured()
        ):
            return

        old_remote_id = note.external_note_id if replace_existing else None
        try:
            remote = await self.workspace_factory.execute(
                user_id=note.user_id,
                service_name="keep",
                version="v1",
                scopes=KEEP_SCOPES,
                operation=lambda service: service.notes()
                .create(body=self._build_remote_note_body(note))
                .execute(),
            )
            remote_id = remote.get("name")
            if remote_id:
                note.external_note_id = remote_id
                await self.note_repo.save(note)
            if old_remote_id and old_remote_id != remote_id:
                await self._delete_remote_note(note.user_id, old_remote_id)
        except Exception:
            logger.exception("Failed to sync note %s to Google Keep.", note.id)

    async def _delete_remote_note(self, user_id: str, remote_note_id: str) -> None:
        try:
            await self.workspace_factory.execute(
                user_id=user_id,
                service_name="keep",
                version="v1",
                scopes=KEEP_SCOPES,
                operation=lambda service: service.notes()
                .delete(name=remote_note_id)
                .execute(),
            )
        except Exception:
            logger.exception("Failed to delete superseded Google Keep note %s.", remote_note_id)

    def _build_remote_note_body(self, note: Note) -> dict:
        return {
            "title": note.title,
            "body": {"text": {"text": note.content}},
        }
