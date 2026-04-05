from __future__ import annotations

import asyncio
from datetime import datetime

from mcp.server.fastmcp import FastMCP

from telova_api.db import init_db, session_scope
from telova_api.integrations.calendar import DatabaseCalendarGateway
from telova_api.repositories.calendar import CalendarEventRepository


mcp = FastMCP("telova-calendar")


@mcp.tool()
async def create_calendar_event(
    user_id: str,
    title: str,
    start_at: str,
    end_at: str,
    description: str = "",
    goal_id: str = "",
    task_id: str = "",
) -> dict:
    async with session_scope() as session:
        gateway = DatabaseCalendarGateway(CalendarEventRepository(session))
        event = await gateway.create_external_event(
            user_id=user_id,
            title=title,
            description=description,
            start_at=datetime.fromisoformat(start_at),
            end_at=datetime.fromisoformat(end_at),
            goal_id=goal_id or None,
            task_id=task_id or None,
        )
        return {
            "event_id": event.id,
            "title": event.title,
            "start_at": event.start_at.isoformat(),
            "end_at": event.end_at.isoformat(),
            "source": event.source,
        }


@mcp.tool()
async def list_calendar_events(user_id: str, hours_ahead: int = 168) -> list[dict]:
    async with session_scope() as session:
        gateway = DatabaseCalendarGateway(CalendarEventRepository(session))
        events = await gateway.list_upcoming(user_id=user_id, hours_ahead=hours_ahead)
        return [
            {
                "event_id": event.id,
                "title": event.title,
                "start_at": event.start_at.isoformat(),
                "end_at": event.end_at.isoformat(),
                "source": event.source,
            }
            for event in events
        ]


if __name__ == "__main__":
    asyncio.run(init_db())
    mcp.run(transport="sse")

