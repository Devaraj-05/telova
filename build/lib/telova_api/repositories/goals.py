from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.models import Goal


class GoalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, goal: Goal) -> Goal:
        self.session.add(goal)
        await self.session.flush()
        await self.session.refresh(goal)
        return goal

    async def get(self, goal_id: str) -> Goal | None:
        return await self.session.get(Goal, goal_id)

    async def list_by_user(self, user_id: str) -> list[Goal]:
        result = await self.session.execute(
            select(Goal).where(Goal.user_id == user_id).order_by(Goal.created_at.desc())
        )
        return list(result.scalars())

    async def list_active(self, user_id: str | None = None) -> list[Goal]:
        stmt = select(Goal).where(Goal.status == "active").order_by(Goal.created_at.desc())
        if user_id:
            stmt = stmt.where(Goal.user_id == user_id)
        result = await self.session.execute(stmt)
        return list(result.scalars())

    async def save(self, goal: Goal) -> Goal:
        await self.session.flush()
        await self.session.refresh(goal)
        return goal


