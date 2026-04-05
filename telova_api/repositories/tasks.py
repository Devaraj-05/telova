from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.models import Task, TaskStatus, utcnow
from telova_api.vectorizer import cosine_similarity, embed_text


class TaskRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_many(self, tasks: list[Task]) -> list[Task]:
        self.session.add_all(tasks)
        await self.session.flush()
        for task in tasks:
            await self.session.refresh(task)
        return tasks

    async def get(self, task_id: str) -> Task | None:
        return await self.session.get(Task, task_id)

    async def list_by_goal(self, goal_id: str) -> list[Task]:
        result = await self.session.execute(
            select(Task)
            .where(Task.goal_id == goal_id)
            .order_by(Task.order_index.asc(), Task.created_at.asc())
        )
        return list(result.scalars())

    async def list_by_user(self, user_id: str) -> list[Task]:
        result = await self.session.execute(
            select(Task)
            .where(Task.user_id == user_id)
            .order_by(Task.updated_at.desc(), Task.created_at.desc())
        )
        return list(result.scalars())

    async def update_status(self, task: Task, status: str) -> Task:
        task.status = status
        task.updated_at = utcnow()
        if status == TaskStatus.DONE.value:
            task.completed_at = utcnow()
        await self.session.flush()
        await self.session.refresh(task)
        return task

    async def save(self, task: Task) -> Task:
        task.updated_at = utcnow()
        await self.session.flush()
        await self.session.refresh(task)
        return task

    async def search(self, user_id: str, query: str, limit: int = 5) -> list[Task]:
        query_embedding = embed_text(query)
        tasks = await self.list_by_user(user_id)
        ranked = sorted(
            tasks,
            key=lambda task: cosine_similarity(task.embedding or [], query_embedding),
            reverse=True,
        )
        return ranked[:limit]

    async def mark_rescheduled(
        self,
        task: Task,
        start_at: datetime,
        end_at: datetime,
    ) -> Task:
        task.scheduled_start = start_at
        task.scheduled_end = end_at
        return await self.save(task)


