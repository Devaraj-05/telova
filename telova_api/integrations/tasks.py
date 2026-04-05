from __future__ import annotations

from telova_api.models import Task
from telova_api.repositories.tasks import TaskRepository


class DatabaseTaskGateway:
    def __init__(self, task_repo: TaskRepository) -> None:
        self.task_repo = task_repo

    async def list_goal_tasks(self, goal_id: str) -> list[Task]:
        return await self.task_repo.list_by_goal(goal_id)

    async def list_user_tasks(self, user_id: str) -> list[Task]:
        return await self.task_repo.list_by_user(user_id)

    async def update_status(self, task: Task, status: str) -> Task:
        return await self.task_repo.update_status(task, status)

    async def save(self, task: Task) -> Task:
        return await self.task_repo.save(task)


