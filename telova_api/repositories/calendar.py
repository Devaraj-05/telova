from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.models import CalendarEvent, utcnow


class CalendarEventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, event: CalendarEvent) -> CalendarEvent:
        self.session.add(event)
        await self.session.flush()
        await self.session.refresh(event)
        return event

    async def get(self, event_id: str) -> CalendarEvent | None:
        return await self.session.get(CalendarEvent, event_id)

    async def get_by_external_event_id(
        self,
        user_id: str,
        external_event_id: str,
    ) -> CalendarEvent | None:
        result = await self.session.execute(
            select(CalendarEvent).where(
                CalendarEvent.user_id == user_id,
                CalendarEvent.external_event_id == external_event_id,
            )
        )
        return result.scalars().first()

    async def list_for_user(
        self,
        user_id: str,
        source: str | None = None,
        limit: int = 100,
    ) -> list[CalendarEvent]:
        stmt = (
            select(CalendarEvent)
            .where(CalendarEvent.user_id == user_id)
            .order_by(CalendarEvent.start_at.asc())
            .limit(limit)
        )
        if source:
            stmt = stmt.where(CalendarEvent.source == source)
        result = await self.session.execute(stmt)
        return list(result.scalars())

    async def list_upcoming(
        self,
        user_id: str,
        hours_ahead: int = 72,
        source: str | None = None,
        goal_id: str | None = None,
    ) -> list[CalendarEvent]:
        now = utcnow()
        end = now + timedelta(hours=hours_ahead)
        stmt = (
            select(CalendarEvent)
            .where(
                CalendarEvent.user_id == user_id,
                CalendarEvent.start_at <= end,
                CalendarEvent.end_at >= now,
            )
            .order_by(CalendarEvent.start_at.asc())
        )
        if source:
            stmt = stmt.where(CalendarEvent.source == source)
        if goal_id:
            stmt = stmt.where(CalendarEvent.goal_id == goal_id)
        result = await self.session.execute(stmt)
        return list(result.scalars())

    async def list_busy_windows(
        self,
        user_id: str,
        start_at: datetime,
        end_at: datetime,
        exclude_event_id: str | None = None,
    ) -> list[CalendarEvent]:
        stmt = select(CalendarEvent).where(
            CalendarEvent.user_id == user_id,
            CalendarEvent.start_at < end_at,
            CalendarEvent.end_at > start_at,
        )
        if exclude_event_id:
            stmt = stmt.where(CalendarEvent.id != exclude_event_id)
        result = await self.session.execute(stmt.order_by(CalendarEvent.start_at.asc()))
        return list(result.scalars())

    async def list_system_events_for_goal(self, goal_id: str) -> list[CalendarEvent]:
        result = await self.session.execute(
            select(CalendarEvent)
            .where(
                CalendarEvent.goal_id == goal_id,
                CalendarEvent.source == "system",
            )
            .order_by(CalendarEvent.start_at.asc())
        )
        return list(result.scalars())

    async def save(self, event: CalendarEvent) -> CalendarEvent:
        event.updated_at = utcnow()
        await self.session.flush()
        await self.session.refresh(event)
        return event


