from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.models import GoogleWorkspaceConnection


class GoogleWorkspaceConnectionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        connection: GoogleWorkspaceConnection,
    ) -> GoogleWorkspaceConnection:
        self.session.add(connection)
        await self.session.flush()
        await self.session.refresh(connection)
        return connection

    async def get_by_user_id(
        self,
        user_id: str,
    ) -> GoogleWorkspaceConnection | None:
        result = await self.session.execute(
            select(GoogleWorkspaceConnection).where(
                GoogleWorkspaceConnection.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def save(
        self,
        connection: GoogleWorkspaceConnection,
    ) -> GoogleWorkspaceConnection:
        await self.session.flush()
        await self.session.refresh(connection)
        return connection

    async def delete(self, connection: GoogleWorkspaceConnection) -> None:
        await self.session.delete(connection)
        await self.session.flush()
