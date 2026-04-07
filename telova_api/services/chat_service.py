from __future__ import annotations

import asyncio
import logging
from typing import Any

from telova_api.config import Settings

logger = logging.getLogger("telova.chat")

SYSTEM_INSTRUCTION = """\
You are Telova, an AI-powered goal-to-execution assistant. Your purpose is to help users with:
- Goal planning and breakdown
- Scheduling and time management
- Task execution tracking
- Follow-ups and progress reviews
- Re-planning when things go off track

Rules:
1. Only answer questions related to planning, execution, scheduling, goal tracking, productivity, and time management.
2. If the user asks something unrelated (e.g. jokes, code, general knowledge), politely decline and redirect them to goal planning.
3. Be concise, actionable, and encouraging.
4. When a user describes a goal, break it into phases, milestones, and tasks.
5. Always suggest next steps the user can take.
6. If the user hasn't connected Google tools, remind them that Telova will store everything locally and they can sync later.
"""


class TelovaChatService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._model_name = settings.adk_model or "gemini-2.5-flash"

    async def chat(self, *, user_message: str, history: list[dict[str, str]] | None = None) -> str:
        """Send a message to the Vertex AI / Gemini model and return the response."""
        try:
            return await self._call_model(user_message, history or [])
        except Exception as exc:
            logger.exception("Chat model call failed: %s", exc)
            return (
                "I'm having trouble connecting to the AI service right now. "
                "Please make sure Vertex AI is configured and try again."
            )

    async def _call_model(self, user_message: str, history: list[dict[str, str]]) -> str:
        from google import genai

        client = genai.Client(
            vertexai=self.settings.google_genai_use_vertexai,
            project=self.settings.google_cloud_project or self.settings.gcp_project_id,
            location=self.settings.google_cloud_location or self.settings.gcp_region,
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
                "max_output_tokens": 1024,
            },
        )

        return response.text or "I couldn't generate a response. Please try again."
