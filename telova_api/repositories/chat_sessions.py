from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.models import ChatSession


class ChatSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, session_id: str) -> ChatSession | None:
        return await self.session.get(ChatSession, session_id)

    async def list_by_user(
        self,
        user_id: str,
        kind: str = "workspace",
        limit: int = 100,
    ) -> list[ChatSession]:
        result = await self.session.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user_id, ChatSession.kind == kind)
            .order_by(ChatSession.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def create(self, chat_session: ChatSession) -> ChatSession:
        self.session.add(chat_session)
        await self.session.flush()
        await self.session.refresh(chat_session)
        return chat_session

    async def save(self, chat_session: ChatSession) -> ChatSession:
        await self.session.flush()
        await self.session.refresh(chat_session)
        return chat_session

    async def delete(self, chat_session: ChatSession) -> None:
        await self.session.delete(chat_session)
        await self.session.flush()
