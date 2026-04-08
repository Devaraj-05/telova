from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from telova_api.config import Settings

logger = logging.getLogger("telova.chat")

SYSTEM_INSTRUCTION = """\
You are Telova, an autonomous Goal-to-Execution AI system. You are NOT a generic chatbot.

You turn user goals into fully executable, day-by-day plans with specific daily tasks, schedules, and follow-ups.

YOUR CONVERSATION FLOW:
1. When a user first describes a goal, acknowledge it warmly and say you'll ask about their background to personalize the plan. Keep it to 2-3 sentences.
2. When generating a FULL PLAN (you'll receive the goal + background + preferences), create a COMPLETE day-by-day plan.

WHEN GENERATING A FULL PLAN:
You MUST produce a COMPLETE day-by-day execution plan covering the ENTIRE timeline. Include ALL of these:

**Your Personalized Plan**
- Restate the goal tailored to their background
- Timeline and daily commitment summary

**Phase-by-Phase Breakdown**
For EACH phase:
- Phase name and week range (e.g., "Phase 1: Foundation — Week 1-2")
- Specific daily tasks for EACH scheduled day with time estimates
- Each day formatted as: **Day N (Mon):** Task title — Xh. Specific actionable description.
- Key milestone at the end of each phase

Example format:
**Phase 1: Foundation — Week 1 (Mon-Fri)**
- **Day 1 (Mon):** HTML5 structure and semantics — 2h. Build a personal HTML page with proper semantic tags.
- **Day 2 (Tue):** CSS Flexbox and Grid — 2h. Recreate 3 real website layouts from scratch.
- **Day 3 (Wed):** Responsive design — 2h. Build a fully responsive landing page.
- **Day 4 (Thu):** JavaScript basics — 2h. Variables, loops, functions, ES6 syntax practice.
- **Day 5 (Fri):** Mini project — 2h. Build and deploy a personal portfolio page. ✅ Milestone

**Weekly Schedule**
- Hours per day and recommended time blocks
- Rest days clearly marked (if applicable)

**Risk Factors & Tips**
- 2-3 realistic risks with mitigation strategies
- Pro tips based on their background

RULES:
- Only answer questions about goal planning, execution, scheduling, tasks, progress, and productivity.
- If asked something unrelated, say: "I'm Telova, your goal execution assistant. I help you plan, schedule, and track goals. What would you like to achieve?"
- Generate COMPLETE day-by-day plans. NEVER cut off mid-plan or say "I'll continue later".
- Use clear formatting with bold headers, bullet points, and numbered lists.
- Be specific — mention real tools, technologies, resources, courses, and platforms relevant to the goal.
- Be encouraging but realistic about timelines.
- Respect the user's schedule: if they said Mon-Fri only, do NOT include Saturday or Sunday tasks.
- Match the hours per day exactly to what the user specified.
- Tailor content to the user's background — a beginner needs different tasks than someone switching fields.
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
        """Send a message to the Vertex AI model and return the response."""
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

        logger.info(
            "Vertex AI chat init: project=%s, location=%s, model=%s",
            project_id or "unset",
            location,
            self._model_name,
        )

        if not project_id:
            raise RuntimeError(
                "No GCP project configured for Vertex AI. "
                "Set GOOGLE_CLOUD_PROJECT in your .env file."
            )

        # Use Vertex AI exclusively
        client = genai.Client(
            vertexai=True,
            project=project_id,
            location=location,
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
