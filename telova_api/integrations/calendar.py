from __future__ import annotations

from datetime import datetime

from telova_api.models import CalendarEvent, EventSource, Goal, Task
from telova_api.repositories.calendar import CalendarEventRepository


class DatabaseCalendarGateway:
    def __init__(self, calendar_repo: CalendarEventRepository) -> None:
        self.calendar_repo = calendar_repo

    async def materialize_task_block(self, goal: Goal, task: Task) -> CalendarEvent:
        event = CalendarEvent(
            user_id=goal.user_id,
            goal_id=goal.id,
            task_id=task.id,
            title=task.title,
            description=task.description,
            source=EventSource.SYSTEM.value,
            start_at=task.scheduled_start,
            end_at=task.scheduled_end,
            metadata_json={
                "phase": task.phase,
                "goal_title": goal.title,
            },
        )
        return await self.calendar_repo.create(event)

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
        return await self.calendar_repo.create(event)

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
        return await self.calendar_repo.save(event)


