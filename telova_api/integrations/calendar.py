from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
import logging

from telova_api.config import Settings
from telova_api.integrations.contracts import IntegrationStatus
from telova_api.integrations.google_workspace import GoogleWorkspaceClientFactory
from telova_api.models import CalendarEvent, EventSource, Goal, McpSyncLog, Task
from telova_api.repositories.calendar import CalendarEventRepository
from telova_api.repositories.analytics import McpSyncLogRepository


logger = logging.getLogger(__name__)

CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar"]


class DatabaseCalendarGateway:
    def __init__(
        self,
        calendar_repo: CalendarEventRepository,
        *,
        sync_log_repo: McpSyncLogRepository | None = None,
    ) -> None:
        self.calendar_repo = calendar_repo
        self.sync_log_repo = sync_log_repo

    async def materialize_task_block(self, goal: Goal, task: Task) -> CalendarEvent:
        event = CalendarEvent(
            user_id=goal.user_id,
            goal_id=goal.id,
            task_id=task.id,
            title=f"[{goal.title}] {task.title}",
            description=f"Goal: {goal.title}\nTask: {task.title}\n\n{task.description}\n\n— Auto-scheduled by Telova",
            source=EventSource.SYSTEM.value,
            start_at=task.scheduled_start,
            end_at=task.scheduled_end,
            metadata_json={
                "phase": task.phase,
                "goal_title": goal.title,
            },
        )
        created = await self.calendar_repo.create(event)
        await self._log_sync(
            user_id=goal.user_id,
            operation="materialize_task_block",
            status="stored",
            resource_type="calendar_event",
            goal_id=goal.id,
            task_id=task.id,
            event_id=created.id,
            local_id=created.id,
            detail="Stored Telova task block in the local calendar cache.",
            payload={"title": task.title, "source": created.source},
        )
        return created

    async def create_external_event(
        self,
        *,
        user_id: str,
        title: str,
        description: str,
        start_at: datetime,
        end_at: datetime,
        goal_id: str | None = None,
        task_id: str | None = None,
    ) -> CalendarEvent:
        event = CalendarEvent(
            user_id=user_id,
            goal_id=goal_id,
            task_id=task_id,
            title=title,
            description=description,
            source=EventSource.EXTERNAL.value,
            start_at=start_at,
            end_at=end_at,
            metadata_json={"origin": "dashboard"},
        )
        created = await self.calendar_repo.create(event)
        await self._log_sync(
            user_id=user_id,
            operation="create_external_event",
            status="stored",
            resource_type="calendar_event",
            goal_id=goal_id,
            task_id=task_id,
            event_id=created.id,
            local_id=created.id,
            detail="Stored external event in the Telova calendar cache.",
            payload={"title": title, "source": created.source},
        )
        return created

    async def list_upcoming(
        self,
        user_id: str,
        hours_ahead: int = 72,
        source: str | None = None,
        goal_id: str | None = None,
    ) -> list[CalendarEvent]:
        return await self.calendar_repo.list_upcoming(
            user_id=user_id,
            hours_ahead=hours_ahead,
            source=source,
            goal_id=goal_id,
        )

    async def list_all(
        self,
        user_id: str,
        source: str | None = None,
        limit: int = 100,
    ) -> list[CalendarEvent]:
        return await self.calendar_repo.list_for_user(
            user_id=user_id,
            source=source,
            limit=limit,
        )

    async def reschedule_task_block(
        self,
        event: CalendarEvent,
        *,
        start_at: datetime,
        end_at: datetime,
        reason: str,
    ) -> CalendarEvent:
        event.start_at = start_at
        event.end_at = end_at
        metadata = dict(event.metadata_json or {})
        metadata["last_reschedule_reason"] = reason
        event.metadata_json = metadata
        updated = await self.calendar_repo.save(event)
        await self._log_sync(
            user_id=updated.user_id,
            operation="reschedule_task_block",
            status="stored",
            resource_type="calendar_event",
            goal_id=updated.goal_id,
            task_id=updated.task_id,
            event_id=updated.id,
            local_id=updated.id,
            detail=reason,
            payload={
                "start_at": updated.start_at.isoformat(),
                "end_at": updated.end_at.isoformat(),
            },
        )
        return updated

    async def describe_status(self, user_id: str) -> IntegrationStatus:
        del user_id
        return IntegrationStatus(
            name="Calendar",
            kind="MCP tool",
            status="connected",
            detail="Using the local database-backed calendar adapter.",
            backend="database",
        )

    async def _log_sync(
        self,
        *,
        user_id: str,
        operation: str,
        status: str,
        resource_type: str,
        goal_id: str | None = None,
        task_id: str | None = None,
        event_id: str | None = None,
        local_id: str | None = None,
        external_id: str | None = None,
        detail: str,
        payload: dict,
    ) -> None:
        if self.sync_log_repo is None:
            return
        await self.sync_log_repo.create(
            McpSyncLog(
                user_id=user_id,
                tool_name="calendar",
                operation=operation,
                status=status,
                resource_type=resource_type,
                goal_id=goal_id,
                task_id=task_id,
                event_id=event_id,
                local_id=local_id,
                external_id=external_id,
                detail=detail,
                payload_json=payload,
            )
        )


class GoogleCalendarGateway(DatabaseCalendarGateway):
    def __init__(
        self,
        calendar_repo: CalendarEventRepository,
        *,
        workspace_factory: GoogleWorkspaceClientFactory,
        settings: Settings,
        sync_log_repo: McpSyncLogRepository | None = None,
    ) -> None:
        super().__init__(calendar_repo, sync_log_repo=sync_log_repo)
        self.workspace_factory = workspace_factory
        self.settings = settings

    async def materialize_task_block(self, goal: Goal, task: Task) -> CalendarEvent:
        event = await super().materialize_task_block(goal, task)
        if not await self.workspace_factory.is_ready(
            goal.user_id,
            scopes=CALENDAR_SCOPES,
        ):
            return event

        try:
            remote_id = await self.workspace_factory.execute(
                user_id=goal.user_id,
                service_name="calendar",
                version="v3",
                scopes=CALENDAR_SCOPES,
                operation=lambda service: service.events()
                .insert(
                    calendarId=self.settings.google_calendar_id,
                    body=self._build_remote_event_body(
                        title=event.title,
                        description=event.description,
                        start_at=task.scheduled_start,
                        end_at=task.scheduled_end,
                        telova_managed=True,
                        metadata={
                            "goal_id": goal.id,
                            "task_id": task.id,
                            "phase": task.phase,
                        },
                    ),
                )
                .execute()
                .get("id"),
            )
            if remote_id:
                event.external_event_id = remote_id
                await self.calendar_repo.save(event)
                await self._log_sync(
                    user_id=goal.user_id,
                    operation="push_task_block_to_google_calendar",
                    status="synced",
                    resource_type="calendar_event",
                    goal_id=goal.id,
                    task_id=task.id,
                    event_id=event.id,
                    local_id=event.id,
                    external_id=remote_id,
                    detail="Created the Telova task block in Google Calendar.",
                    payload={"calendar_id": self.settings.google_calendar_id},
                )
        except Exception:
            logger.exception("Failed to sync Telova task block to Google Calendar.")
            await self._log_sync(
                user_id=goal.user_id,
                operation="push_task_block_to_google_calendar",
                status="failed",
                resource_type="calendar_event",
                goal_id=goal.id,
                task_id=task.id,
                event_id=event.id,
                local_id=event.id,
                detail="Failed to create the Telova task block in Google Calendar.",
                payload={"calendar_id": self.settings.google_calendar_id},
            )
        return event

    async def create_external_event(
        self,
        *,
        user_id: str,
        title: str,
        description: str,
        start_at: datetime,
        end_at: datetime,
        goal_id: str | None = None,
        task_id: str | None = None,
    ) -> CalendarEvent:
        event = await super().create_external_event(
            user_id=user_id,
            title=title,
            description=description,
            start_at=start_at,
            end_at=end_at,
            goal_id=goal_id,
            task_id=task_id,
        )
        if not await self.workspace_factory.is_ready(
            user_id,
            scopes=CALENDAR_SCOPES,
        ):
            return event

        try:
            remote_id = await self.workspace_factory.execute(
                user_id=user_id,
                service_name="calendar",
                version="v3",
                scopes=CALENDAR_SCOPES,
                operation=lambda service: service.events()
                .insert(
                    calendarId=self.settings.google_calendar_id,
                    body=self._build_remote_event_body(
                        title=title,
                        description=description,
                        start_at=start_at,
                        end_at=end_at,
                        telova_managed=False,
                        metadata={"goal_id": goal_id, "task_id": task_id},
                    ),
                )
                .execute()
                .get("id"),
            )
            if remote_id:
                event.external_event_id = remote_id
                await self.calendar_repo.save(event)
                await self._log_sync(
                    user_id=user_id,
                    operation="push_external_event_to_google_calendar",
                    status="synced",
                    resource_type="calendar_event",
                    goal_id=goal_id,
                    task_id=task_id,
                    event_id=event.id,
                    local_id=event.id,
                    external_id=remote_id,
                    detail="Created the external event in Google Calendar.",
                    payload={"calendar_id": self.settings.google_calendar_id},
                )
        except Exception:
            logger.exception("Failed to create external event in Google Calendar.")
            await self._log_sync(
                user_id=user_id,
                operation="push_external_event_to_google_calendar",
                status="failed",
                resource_type="calendar_event",
                goal_id=goal_id,
                task_id=task_id,
                event_id=event.id,
                local_id=event.id,
                detail="Failed to create the external event in Google Calendar.",
                payload={"calendar_id": self.settings.google_calendar_id},
            )
        return event

    async def list_upcoming(
        self,
        user_id: str,
        hours_ahead: int = 72,
        source: str | None = None,
        goal_id: str | None = None,
    ) -> list[CalendarEvent]:
        if source in {None, EventSource.EXTERNAL.value}:
            await self._sync_external_events(user_id, hours_ahead=hours_ahead)
        return await super().list_upcoming(
            user_id=user_id,
            hours_ahead=hours_ahead,
            source=source,
            goal_id=goal_id,
        )

    async def list_all(
        self,
        user_id: str,
        source: str | None = None,
        limit: int = 100,
    ) -> list[CalendarEvent]:
        if source in {None, EventSource.EXTERNAL.value}:
            await self._sync_external_events(user_id, hours_ahead=24 * 30)
        return await super().list_all(user_id=user_id, source=source, limit=limit)

    async def reschedule_task_block(
        self,
        event: CalendarEvent,
        *,
        start_at: datetime,
        end_at: datetime,
        reason: str,
    ) -> CalendarEvent:
        updated = await super().reschedule_task_block(
            event,
            start_at=start_at,
            end_at=end_at,
            reason=reason,
        )
        if not updated.external_event_id:
            return updated
        if not await self.workspace_factory.is_ready(
            updated.user_id,
            scopes=CALENDAR_SCOPES,
        ):
            return updated

        try:
            await self.workspace_factory.execute(
                user_id=updated.user_id,
                service_name="calendar",
                version="v3",
                scopes=CALENDAR_SCOPES,
                operation=lambda service: service.events()
                .patch(
                    calendarId=self.settings.google_calendar_id,
                    eventId=updated.external_event_id,
                    body=self._build_remote_event_body(
                        title=updated.title,
                        description=updated.description,
                        start_at=updated.start_at,
                        end_at=updated.end_at,
                        telova_managed=updated.source == EventSource.SYSTEM.value,
                        metadata=dict(updated.metadata_json or {}),
                    ),
                )
                .execute(),
            )
            await self._log_sync(
                user_id=updated.user_id,
                operation="reschedule_google_calendar_event",
                status="synced",
                resource_type="calendar_event",
                goal_id=updated.goal_id,
                task_id=updated.task_id,
                event_id=updated.id,
                local_id=updated.id,
                external_id=updated.external_event_id,
                detail=reason,
                payload={"calendar_id": self.settings.google_calendar_id},
            )
        except Exception:
            logger.exception("Failed to reschedule Google Calendar event %s.", event.id)
            await self._log_sync(
                user_id=updated.user_id,
                operation="reschedule_google_calendar_event",
                status="failed",
                resource_type="calendar_event",
                goal_id=updated.goal_id,
                task_id=updated.task_id,
                event_id=updated.id,
                local_id=updated.id,
                external_id=updated.external_event_id,
                detail="Failed to reschedule the Google Calendar event.",
                payload={"calendar_id": self.settings.google_calendar_id},
            )
        return updated

    async def describe_status(self, user_id: str) -> IntegrationStatus:
        if not await self.workspace_factory.is_ready(
            user_id,
            scopes=CALENDAR_SCOPES,
        ):
            return IntegrationStatus(
                name="Calendar",
                kind="Google Calendar",
                status="warning",
                detail=(
                    "Google backend is enabled, but Calendar access is not "
                    "connected for this user yet. Falling back to local calendar storage."
                ),
                backend="google",
            )

        return IntegrationStatus(
            name="Calendar",
            kind="Google Calendar",
            status="connected",
            detail=(
                "Syncing live external calendar commitments and pushing "
                f"Telova task blocks to calendar {self.settings.google_calendar_id}."
            ),
            backend="google",
        )

    async def _sync_external_events(self, user_id: str, *, hours_ahead: int) -> None:
        if not await self.workspace_factory.is_ready(
            user_id,
            scopes=CALENDAR_SCOPES,
        ):
            return

        now = datetime.now(UTC)
        time_min = (now - timedelta(hours=6)).isoformat()
        time_max = (now + timedelta(hours=max(hours_ahead, 24))).isoformat()

        try:
            remote_items = await self.workspace_factory.execute(
                user_id=user_id,
                service_name="calendar",
                version="v3",
                scopes=CALENDAR_SCOPES,
                operation=lambda service: service.events()
                .list(
                    calendarId=self.settings.google_calendar_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy="startTime",
                    maxResults=250,
                )
                .execute()
                .get("items", []),
            )
        except Exception:
            logger.exception("Failed to sync Google Calendar events for %s.", user_id)
            return

        for item in remote_items:
            if item.get("status") == "cancelled":
                continue
            remote_id = item.get("id")
            if not remote_id:
                continue

            private_props = (
                item.get("extendedProperties", {}).get("private", {}) or {}
            )
            telova_managed = private_props.get("telovaManaged") == "true"
            existing = await self.calendar_repo.get_by_external_event_id(
                user_id=user_id,
                external_event_id=remote_id,
            )

            if telova_managed:
                if existing and existing.source == EventSource.SYSTEM.value:
                    existing.start_at = self._parse_google_datetime(item["start"])
                    existing.end_at = self._parse_google_datetime(item["end"])
                    existing.metadata_json = {
                        **dict(existing.metadata_json or {}),
                        "html_link": item.get("htmlLink"),
                    }
                    await self.calendar_repo.save(existing)
                continue

            start_at = self._parse_google_datetime(item["start"])
            end_at = self._parse_google_datetime(item["end"])
            metadata = {
                "origin": "google-calendar",
                "html_link": item.get("htmlLink"),
                "etag": item.get("etag"),
            }

            if existing is None:
                await self.calendar_repo.create(
                    CalendarEvent(
                        user_id=user_id,
                        goal_id=None,
                        task_id=None,
                        title=item.get("summary") or "Untitled event",
                        description=item.get("description") or "",
                        source=EventSource.EXTERNAL.value,
                        start_at=start_at,
                        end_at=end_at,
                        external_event_id=remote_id,
                        metadata_json=metadata,
                    )
                )
                continue

            existing.title = item.get("summary") or existing.title
            existing.description = item.get("description") or ""
            existing.start_at = start_at
            existing.end_at = end_at
            existing.source = EventSource.EXTERNAL.value
            existing.metadata_json = metadata
            await self.calendar_repo.save(existing)

    def _build_remote_event_body(
        self,
        *,
        title: str,
        description: str,
        start_at: datetime,
        end_at: datetime,
        telova_managed: bool,
        metadata: dict,
    ) -> dict:
        private_metadata = {
            "telovaManaged": "true" if telova_managed else "false",
        }
        for key, value in metadata.items():
            if value is not None:
                private_metadata[f"telova_{key}"] = str(value)

        return {
            "summary": title,
            "description": description,
            "start": {"dateTime": start_at.astimezone(UTC).isoformat()},
            "end": {"dateTime": end_at.astimezone(UTC).isoformat()},
            "extendedProperties": {"private": private_metadata},
        }

    def _parse_google_datetime(self, payload: dict) -> datetime:
        if "dateTime" in payload:
            return datetime.fromisoformat(
                payload["dateTime"].replace("Z", "+00:00")
            ).astimezone(UTC)
        all_day = date.fromisoformat(payload["date"])
        return datetime.combine(all_day, datetime.min.time(), tzinfo=UTC)
