from __future__ import annotations

import logging

from telova_api.config import Settings
from telova_api.integrations.contracts import IntegrationStatus
from telova_api.integrations.google_workspace import (
    GoogleWorkspaceClientFactory,
    GoogleWorkspaceConfigurationError,
)
from telova_api.models import Goal, Task, TaskStatus
from telova_api.repositories.tasks import TaskRepository


logger = logging.getLogger(__name__)

TASKS_SCOPES = ["https://www.googleapis.com/auth/tasks"]


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

    async def sync_generated_tasks(self, goal: Goal, tasks: list[Task]) -> list[Task]:
        del goal
        return tasks

    async def describe_status(self, user_id: str) -> IntegrationStatus:
        del user_id
        return IntegrationStatus(
            name="Tasks",
            kind="MCP tool",
            status="connected",
            detail="Using the local database-backed task adapter.",
            backend="database",
        )


class GoogleTaskGateway(DatabaseTaskGateway):
    def __init__(
        self,
        task_repo: TaskRepository,
        *,
        workspace_factory: GoogleWorkspaceClientFactory,
        settings: Settings,
    ) -> None:
        super().__init__(task_repo)
        self.workspace_factory = workspace_factory
        self.settings = settings
        self._tasklist_cache: dict[str, str] = {}

    async def list_goal_tasks(self, goal_id: str) -> list[Task]:
        goal_tasks = await super().list_goal_tasks(goal_id)
        if goal_tasks:
            await self._sync_remote_statuses(goal_tasks[0].user_id)
        return await super().list_goal_tasks(goal_id)

    async def list_user_tasks(self, user_id: str) -> list[Task]:
        await self._sync_remote_statuses(user_id)
        return await super().list_user_tasks(user_id)

    async def update_status(self, task: Task, status: str) -> Task:
        updated = await super().update_status(task, status)
        await self._push_status(updated)
        return updated

    async def sync_generated_tasks(self, goal: Goal, tasks: list[Task]) -> list[Task]:
        if not self.workspace_factory.is_configured():
            return tasks

        try:
            tasklist_id = await self._resolve_tasklist_id(goal.user_id)
        except Exception:
            logger.exception("Unable to resolve Google Tasks tasklist for sync.")
            return tasks

        for task in tasks:
            if task.external_task_id:
                continue
            try:
                remote_task_id = await self.workspace_factory.execute(
                    user_id=goal.user_id,
                    service_name="tasks",
                    version="v1",
                    scopes=TASKS_SCOPES,
                    operation=lambda service: service.tasks()
                    .insert(
                        tasklist=tasklist_id,
                        body=self._build_remote_task_body(goal, task),
                    )
                    .execute()
                    .get("id"),
                )
                if remote_task_id:
                    task.external_task_id = remote_task_id
                    await self.task_repo.save(task)
            except Exception:
                logger.exception("Failed to sync task %s to Google Tasks.", task.id)
        return tasks

    async def describe_status(self, user_id: str) -> IntegrationStatus:
        if not self.workspace_factory.is_configured():
            return IntegrationStatus(
                name="Tasks",
                kind="Google Tasks",
                status="warning",
                detail=(
                    "Google backend is enabled, but Google Tasks credentials are "
                    "not fully configured. Falling back to the local task cache."
                ),
                backend="google",
            )

        tasklist_id = self.settings.google_tasks_tasklist_id or self._tasklist_cache.get(
            user_id
        )
        detail = "Syncing Telova-managed tasks to Google Tasks."
        if tasklist_id:
            detail = f"{detail} Active tasklist: {tasklist_id}."
        return IntegrationStatus(
            name="Tasks",
            kind="Google Tasks",
            status="connected",
            detail=detail,
            backend="google",
        )

    async def _sync_remote_statuses(self, user_id: str) -> None:
        if not self.workspace_factory.is_configured():
            return

        synced_tasks = await self.task_repo.list_synced_by_user(user_id)
        if not synced_tasks:
            return

        try:
            tasklist_id = await self._resolve_tasklist_id(user_id)
            remote_items = await self.workspace_factory.execute(
                user_id=user_id,
                service_name="tasks",
                version="v1",
                scopes=TASKS_SCOPES,
                operation=lambda service: service.tasks()
                .list(
                    tasklist=tasklist_id,
                    showCompleted=True,
                    showHidden=True,
                    maxResults=100,
                )
                .execute()
                .get("items", []),
            )
        except Exception:
            logger.exception("Failed to pull Google Tasks statuses for %s.", user_id)
            return

        remote_by_id = {item.get("id"): item for item in remote_items if item.get("id")}
        for task in synced_tasks:
            remote = remote_by_id.get(task.external_task_id or "")
            if not remote:
                continue
            remote_status = remote.get("status")
            desired_status = (
                TaskStatus.DONE.value
                if remote_status == "completed"
                else TaskStatus.PENDING.value
            )
            if task.status != desired_status:
                await self.task_repo.update_status(task, desired_status)

    async def _push_status(self, task: Task) -> None:
        if not self.workspace_factory.is_configured() or not task.external_task_id:
            return

        try:
            tasklist_id = await self._resolve_tasklist_id(task.user_id)
            await self.workspace_factory.execute(
                user_id=task.user_id,
                service_name="tasks",
                version="v1",
                scopes=TASKS_SCOPES,
                operation=lambda service: service.tasks()
                .patch(
                    tasklist=tasklist_id,
                    task=task.external_task_id,
                    body={
                        "status": (
                            "completed"
                            if task.status == TaskStatus.DONE.value
                            else "needsAction"
                        ),
                    },
                )
                .execute(),
            )
        except Exception:
            logger.exception("Failed to push task status to Google Tasks.")

    async def _resolve_tasklist_id(self, user_id: str) -> str:
        if self.settings.google_tasks_tasklist_id:
            return self.settings.google_tasks_tasklist_id
        if user_id in self._tasklist_cache:
            return self._tasklist_cache[user_id]

        try:
            tasklists = await self.workspace_factory.execute(
                user_id=user_id,
                service_name="tasks",
                version="v1",
                scopes=TASKS_SCOPES,
                operation=lambda service: service.tasklists()
                .list(maxResults=20)
                .execute()
                .get("items", []),
            )
        except GoogleWorkspaceConfigurationError:
            raise

        if not tasklists:
            raise RuntimeError("No Google Tasks tasklists are available for this user.")

        tasklist_id = tasklists[0]["id"]
        self._tasklist_cache[user_id] = tasklist_id
        return tasklist_id

    def _build_remote_task_body(self, goal: Goal, task: Task) -> dict:
        notes_lines = [
            f"Telova goal: {goal.title}",
            f"Telova goal ID: {goal.id}",
            f"Telova task ID: {task.id}",
            "",
            task.description,
        ]
        return {
            "title": task.title,
            "notes": "\n".join(line for line in notes_lines if line is not None),
            "status": (
                "completed"
                if task.status == TaskStatus.DONE.value
                else "needsAction"
            ),
        }
