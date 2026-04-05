from __future__ import annotations

from telova_api.models import ContextPackage, Note, NoteType, ReplanEvent
from telova_api.repositories.notes import (
    ContextPackageRepository,
    NoteRepository,
    ReplanRepository,
)


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

    async def create_replan_event(self, event: ReplanEvent) -> ReplanEvent:
        return await self.replan_repo.create(event)


