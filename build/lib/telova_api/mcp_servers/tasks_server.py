from __future__ import annotations

import asyncio

from mcp.server.fastmcp import FastMCP

from telova_api.db import init_db, session_scope
from telova_api.models import Task
from telova_api.repositories.tasks import TaskRepository
from telova_api.vectorizer import embed_text


mcp = FastMCP("telova-tasks")


@mcp.tool()
async def create_task(
    user_id: str,
    goal_id: str,
    title: str,
    description: str = "",
    estimated_minutes: int = 60,
) -> dict:
    async with session_scope() as session:
        repo = TaskRepository(session)
        created = await repo.create_many(
            [
                Task(
                    user_id=user_id,
                    goal_id=goal_id,
                    title=title,
                    description=description,
                    estimated_minutes=estimated_minutes,
                    embedding=embed_text(f"{title} {description}"),
                )
            ]
        )
        task = created[0]
        return {"task_id": task.id, "status": task.status, "title": task.title}


@mcp.tool()
async def update_task_status(task_id: str, status: str) -> dict:
    async with session_scope() as session:
        repo = TaskRepository(session)
        task = await repo.get(task_id)
        if task is None:
            return {"error": "task_not_found"}
        task = await repo.update_status(task, status)
        return {"task_id": task.id, "status": task.status}


@mcp.tool()
async def list_tasks(goal_id: str) -> list[dict]:
    async with session_scope() as session:
        repo = TaskRepository(session)
        tasks = await repo.list_by_goal(goal_id)
        return [
            {
                "task_id": task.id,
                "title": task.title,
                "status": task.status,
                "scheduled_start": task.scheduled_start.isoformat()
                if task.scheduled_start
                else None,
                "scheduled_end": task.scheduled_end.isoformat()
                if task.scheduled_end
                else None,
            }
            for task in tasks
        ]


if __name__ == "__main__":
    asyncio.run(init_db())
    mcp.run(transport="sse")


