from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from telova_api.config import Settings

logger = logging.getLogger("telova.chat")

SYSTEM_INSTRUCTION = """\
You are Telova, an autonomous Goal-to-Execution AI system. You are NOT a generic chatbot.

You turn user goals into fully executable plans with schedules, tasks, and follow-ups.

WHEN A USER DESCRIBES A GOAL:
You MUST generate a COMPLETE execution plan with ALL of the following sections:

**Goal Understanding**
- Restate the goal clearly
- Identify the timeline and constraints

**Execution Plan**
Break the goal into 3-5 phases. For EACH phase include:
- Phase name and duration (e.g., "Phase 1: Foundation — Week 1-2")
- 3-6 specific tasks with time estimates per task
- Key milestone at the end of each phase
- Dependencies (what must be done before this phase)

**Daily Schedule Template**
- Suggest how many hours per day
- Morning/evening split if applicable
- Rest days included

**Risk Factors**
- 2-3 things that could derail the plan
- Mitigation strategies for each

**Approval Request**
At the end, ALWAYS ask:
"Would you like me to approve this plan? Once approved, I will:
- Create calendar blocks for each phase
- Add tasks to your task list with deadlines
- Set up daily follow-up notes
Type 'Approve' to start execution, or tell me what you'd like to change."

RULES:
- Only answer questions about goal planning, execution, scheduling, tasks, progress, and productivity.
- If asked something unrelated, say: "I'm Telova, your goal execution assistant. I help you plan, schedule, and track goals. What would you like to achieve?"
- Generate COMPLETE plans. Never say "I'll continue later" or cut off mid-plan.
- Use clear formatting with bold headers, bullet points, and numbered lists.
- Be encouraging but realistic about timelines.
- When user says "Approve" or "Yes" or "Proceed": Confirm the plan is locked and mention that tasks will be synced to their connected Google tools (Calendar, Tasks, Keep).
"""


class TelovaChatService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._model_name = settings.adk_model or "gemini-2.5-flash"

    def _resolve_project_id(self) -> str | None:
        """Try multiple sources to find a GCP project ID."""
        return (
            self.settings.google_cloud_project
            or self.settings.gcp_project_id
            or os.environ.get("GOOGLE_CLOUD_PROJECT")
            or os.environ.get("GCLOUD_PROJECT")
            or os.environ.get("DEVSHELL_PROJECT_ID")
            or None
        )

    async def chat(self, *, user_message: str, history: list[dict[str, str]] | None = None) -> str:
        """Send a message to the Gemini model and return the response."""
        try:
            return await self._call_model(user_message, history or [])
        except Exception as exc:
            logger.exception("Chat model call failed: %s", exc)
            return (
                "I'm having trouble connecting to the AI service right now. "
                f"Error: {type(exc).__name__}: {exc}"
            )

    async def _call_model(self, user_message: str, history: list[dict[str, str]]) -> str:
        try:
            from google import genai
        except ImportError:
            raise RuntimeError(
                "google-genai package is not installed. "
                "Run: pip install google-genai"
            )

        project_id = self._resolve_project_id()
        location = self.settings.google_cloud_location or "us-central1"
        api_key = self.settings.google_api_key

        logger.info(
            "Chat init: api_key=%s, project=%s, model=%s",
            "set" if api_key else "unset",
            project_id or "unset",
            self._model_name,
        )

        # Prefer API key (simplest, works without gcloud auth)
        # MUST explicitly set vertexai=False because the SDK reads
        # GOOGLE_GENAI_USE_VERTEXAI from the environment and would
        # otherwise route to aiplatform.googleapis.com which rejects API keys.
        if api_key:
            client = genai.Client(api_key=api_key, vertexai=False)
        elif project_id:
            client = genai.Client(
                vertexai=True,
                project=project_id,
                location=location,
            )
        else:
            raise RuntimeError(
                "No GOOGLE_API_KEY or GCP_PROJECT_ID configured. "
                "Set one in your .env file."
            )

        # Build contents from history + new message
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
                "system_instruction": SYSTEM_INSTRUCTION,
                "temperature": 0.7,
                "max_output_tokens": 8192,
            },
        )

        return response.text or "I couldn't generate a response. Please try again."
