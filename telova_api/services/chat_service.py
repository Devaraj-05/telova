from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from telova_api.config import Settings

logger = logging.getLogger("telova.chat")

SYSTEM_INSTRUCTION = """\
You are Telova, an autonomous Goal-to-Execution AI assistant. You are NOT a generic chatbot.

Your single purpose is to help users achieve their goals by:
1. Understanding their goal from a natural language description
2. Breaking goals into dependency-aware execution plans (phases, milestones, tasks)
3. Creating intelligent schedules with realistic time estimates
4. Tracking progress and adapting plans when things go off track
5. Providing daily action items and follow-ups

RULES:
- Only answer questions related to goal planning, execution, scheduling, task management, progress tracking, time management, and productivity.
- If a user describes a goal, break it into clear phases with milestones and actionable tasks. Include time estimates.
- Always suggest concrete next steps the user should take.
- If the user asks something unrelated (jokes, code help, general knowledge, etc.), politely say: "I'm Telova, your goal execution assistant. I can help you plan, schedule, and track goals. What would you like to achieve?"
- Be concise, actionable, and encouraging.
- Format responses with clear structure using bullet points and sections when breaking down plans.
- If the user hasn't connected Google tools, mention that Telova will store everything locally and they can connect Google Calendar and Tasks later to sync automatically.
- When a user shares progress or completion, acknowledge it and suggest what comes next.
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
        if api_key:
            client = genai.Client(api_key=api_key)
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
                "max_output_tokens": 1024,
            },
        )

        return response.text or "I couldn't generate a response. Please try again."
