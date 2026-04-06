from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.models import AgentRun, McpSyncLog


class AgentRunRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, run: AgentRun) -> AgentRun:
        self.session.add(run)
        await self.session.flush()
        await self.session.refresh(run)
        return run

    async def list_by_user(self, user_id: str, limit: int = 20) -> list[AgentRun]:
        result = await self.session.execute(
            select(AgentRun)
            .where(AgentRun.user_id == user_id)
            .order_by(AgentRun.started_at.desc())
            .limit(limit)
        )
        return list(result.scalars())


class McpSyncLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, log: McpSyncLog) -> McpSyncLog:
        self.session.add(log)
        await self.session.flush()
        await self.session.refresh(log)
        return log

    async def list_by_user(self, user_id: str, limit: int = 50) -> list[McpSyncLog]:
        result = await self.session.execute(
            select(McpSyncLog)
            .where(McpSyncLog.user_id == user_id)
            .order_by(McpSyncLog.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())
