from __future__ import annotations

import asyncio

from mcp.server.fastmcp import FastMCP

from telova_api.db import init_db, session_scope
from telova_api.models import Note, NoteType
from telova_api.repositories.notes import NoteRepository


mcp = FastMCP("telova-notes")


@mcp.tool()
async def create_note(
    user_id: str,
    title: str,
    content: str,
    goal_id: str = "",
) -> dict:
    async with session_scope() as session:
        repo = NoteRepository(session)
        note = await repo.create_note(
            Note(
                user_id=user_id,
                goal_id=goal_id or None,
                title=title,
                content=content,
                note_type=NoteType.MANUAL.value,
                metadata_json={},
            )
        )
        return {"note_id": note.id, "title": note.title}


@mcp.tool()
async def list_notes(user_id: str, goal_id: str = "") -> list[dict]:
    async with session_scope() as session:
        repo = NoteRepository(session)
        notes = (
            await repo.list_by_goal(goal_id)
            if goal_id
            else await repo.list_by_user(user_id)
        )
        return [
            {
                "note_id": note.id,
                "title": note.title,
                "note_type": note.note_type,
                "created_at": note.created_at.isoformat(),
            }
            for note in notes
        ]


if __name__ == "__main__":
    asyncio.run(init_db())
    mcp.run(transport="sse")

