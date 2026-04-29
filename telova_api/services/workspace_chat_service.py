from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.config import Settings
from telova_api.repositories.goals import GoalRepository
from telova_api.repositories.tasks import TaskRepository
from telova_api.services.chat_service import SYSTEM_INSTRUCTION

logger = logging.getLogger("telova.workspace_chat")

_WORKSPACE_CONTEXT_TEMPLATE = """\

--- Current Workspace Context ---
Active goal: "{title}"
Domain: {domain} | Deadline: {deadline}
Progress: {done}/{total} tasks complete{overdue_line}
Next task: {next_task}
--- End Context ---

Use this context to give specific, actionable answers about their current plan.
"""


class WorkspaceChatService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.settings = settings
        self.session = session
        self._model_name = settings.adk_model or "gemini-2.5-flash"

    def _resolve_project_id(self) -> str | None:
        return (
            self.settings.google_cloud_project
            or self.settings.gcp_project_id
            or os.environ.get("GOOGLE_CLOUD_PROJECT")
            or os.environ.get("GCLOUD_PROJECT")
            or os.environ.get("DEVSHELL_PROJECT_ID")
            or None
        )

    async def _build_context(self, user_id: str, goal_id: str | None) -> str:
        """Fetch active goal + tasks and return a context string for the system prompt."""
        try:
            goal_repo = GoalRepository(self.session)
            task_repo = TaskRepository(self.session)

            goal = None
            if goal_id:
                goal = await goal_repo.get(goal_id)
                if goal is not None and goal.user_id != user_id:
                    goal = None
            if goal is None:
                active = await goal_repo.list_active(user_id)
                goal = active[0] if active else None

            if goal is None:
                return ""

            tasks = await task_repo.list_by_goal(goal.id)
            now = datetime.now(timezone.utc)
            done = sum(1 for t in tasks if t.status == "done")
            total = len(tasks)
            overdue = sum(
                1
                for t in tasks
                if t.status not in ("done",) and t.scheduled_end and t.scheduled_end < now
            )
            next_task = next(
                (t.title for t in tasks if t.status in ("pending", "active")),
                "No pending tasks",
            )
            deadline_str = (
                goal.deadline.strftime("%Y-%m-%d") if goal.deadline else "No deadline set"
            )
            overdue_line = f" | {overdue} overdue" if overdue else ""

            return _WORKSPACE_CONTEXT_TEMPLATE.format(
                title=goal.title,
                domain=goal.domain or "general",
                deadline=deadline_str,
                done=done,
                total=total,
                overdue_line=overdue_line,
                next_task=next_task,
            )
        except Exception:
            logger.exception("Failed to build workspace context")
            return ""

    async def chat(
        self,
        *,
        user_id: str,
        user_message: str,
        history: list[dict[str, str]] | None = None,
        goal_id: str | None = None,
    ) -> dict[str, Any]:
        context = await self._build_context(user_id, goal_id)
        system_prompt = SYSTEM_INSTRUCTION + context

        planning_mode = "online"
        try:
            reply = await self._call_model(user_message, history or [], system_prompt)
        except Exception as exc:
            logger.exception("Workspace chat model call failed: %s", exc)
            reply = self._deterministic_fallback(user_message, context)
            planning_mode = "offline"

        return {
            "message": reply,
            "metadata": {
                "agent": "orchestrator",
                "model": self._model_name,
                "planning_mode": planning_mode,
            },
        }

    def _deterministic_fallback(self, user_message: str, context: str) -> str:
        if context:
            return (
                "I couldn't reach the AI service right now, but based on your workspace: "
                + context.strip().replace("---", "").strip()
                + "\n\nPlease try your question again in a moment."
            )
        return (
            "I couldn't reach the planning agent right now. "
            "Please try again in a moment, or check the backend connection."
        )

    async def _call_model(
        self,
        user_message: str,
        history: list[dict[str, str]],
        system_prompt: str,
    ) -> str:
        try:
            from google import genai
        except ImportError:
            raise RuntimeError("google-genai package is not installed.")

        project_id = self._resolve_project_id()
        location = self.settings.google_cloud_location or "us-central1"

        if not project_id:
            raise RuntimeError("No GCP project configured for Vertex AI.")

        client = genai.Client(vertexai=True, project=project_id, location=location)

        contents: list[dict[str, Any]] = []
        for msg in history:
            role = "user" if msg.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        response = await asyncio.to_thread(
            client.models.generate_content,
            model=self._model_name,
            contents=contents,
            config={
                "system_instruction": system_prompt,
                "temperature": 0.7,
                "max_output_tokens": 8192,
            },
        )

        return response.text or "I couldn't generate a response. Please try again."
