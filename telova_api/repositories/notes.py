from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.models import ContextPackage, Note, ReplanEvent


class NoteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, note_id: str) -> Note | None:
        return await self.session.get(Note, note_id)

    async def get_by_external_note_id(
        self,
        user_id: str,
        external_note_id: str,
    ) -> Note | None:
        result = await self.session.execute(
            select(Note).where(
                Note.user_id == user_id,
                Note.external_note_id == external_note_id,
            )
        )
        return result.scalars().first()

    async def create_note(self, note: Note) -> Note:
        self.session.add(note)
        await self.session.flush()
        await self.session.refresh(note)
        return note

    async def save(self, note: Note) -> Note:
        await self.session.flush()
        await self.session.refresh(note)
        return note

    async def list_by_user(self, user_id: str, limit: int = 20) -> list[Note]:
        result = await self.session.execute(
            select(Note)
            .where(Note.user_id == user_id)
            .order_by(Note.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def list_by_goal(self, goal_id: str) -> list[Note]:
        result = await self.session.execute(
            select(Note)
            .where(Note.goal_id == goal_id)
            .order_by(Note.created_at.desc())
        )
        return list(result.scalars())


class ContextPackageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, context_package: ContextPackage) -> ContextPackage:
        self.session.add(context_package)
        await self.session.flush()
        await self.session.refresh(context_package)
        return context_package


class ReplanRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, event: ReplanEvent) -> ReplanEvent:
        self.session.add(event)
        await self.session.flush()
        await self.session.refresh(event)
        return event


