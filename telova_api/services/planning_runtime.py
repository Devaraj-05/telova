from __future__ import annotations

from dataclasses import dataclass
import json
import logging
from uuid import uuid4

from pydantic import BaseModel, Field

from telova_api.agents.goal_decomposer import (
    BlueprintTask,
    GoalDecomposerAgent,
    GoalDecompositionResult,
)
from telova_api.config import Settings
from telova_api.services.scheduling import BusyWindow


logger = logging.getLogger(__name__)


class AdkBlueprintTask(BaseModel):
    key: str = Field(min_length=3, max_length=64)
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=8, max_length=1200)
    phase: str = Field(min_length=3, max_length=64)
    estimated_minutes: int = Field(ge=30, le=480)
    depends_on: list[str] = Field(default_factory=list)
    milestone: bool = False


class AdkPlanEnvelope(BaseModel):
    domain: str
    tasks: list[AdkBlueprintTask] = Field(min_length=4, max_length=10)


@dataclass(frozen=True)
class PlanningRuntimeStatus:
    name: str
    status: str
    detail: str


class DeterministicPlanningRuntime:
    def __init__(self, goal_decomposer: GoalDecomposerAgent) -> None:
        self.goal_decomposer = goal_decomposer

    def build_plan(
        self,
        *,
        goal_text: str,
        description: str | None,
        deadline,
        busy_windows: list[BusyWindow],
        detailed_plan_text: str | None = None,
    ) -> GoalDecompositionResult:
        return self.goal_decomposer.build_plan(
            goal_text=goal_text,
            description=description,
            deadline=deadline,
            busy_windows=busy_windows,
            detailed_plan_text=detailed_plan_text,
        )

    def describe_status(self) -> PlanningRuntimeStatus:
        return PlanningRuntimeStatus(
            name="Deterministic Planner",
            status="ready",
            detail="Using the built-in decomposition and scheduling agents.",
        )


class GoogleAdkPlanningRuntime:
    def __init__(
        self,
        *,
        settings: Settings,
        goal_decomposer: GoalDecomposerAgent,
        fallback_runtime: DeterministicPlanningRuntime,
    ) -> None:
        self.settings = settings
        self.goal_decomposer = goal_decomposer
        self.fallback_runtime = fallback_runtime

    async def build_plan(
        self,
        *,
        goal_text: str,
        description: str | None,
        deadline,
        busy_windows: list[BusyWindow],
        detailed_plan_text: str | None = None,
    ) -> GoalDecompositionResult:
        if detailed_plan_text:
            return self.goal_decomposer.build_plan(
                goal_text=goal_text,
                description=description,
                deadline=deadline,
                busy_windows=busy_windows,
                detailed_plan_text=detailed_plan_text,
            )

        try:
            blueprint = await self._generate_blueprint(goal_text, description)
        except Exception:
            logger.exception(
                "Google ADK planning failed. Falling back to deterministic runtime."
            )
            return self.fallback_runtime.build_plan(
                goal_text=goal_text,
                description=description,
                deadline=deadline,
                busy_windows=busy_windows,
                detailed_plan_text=detailed_plan_text,
            )

        domain = blueprint.domain or self.goal_decomposer.classify_goal(goal_text)
        rendered_blueprint = self._coerce_blueprint_tasks(blueprint.tasks)
        return self.goal_decomposer.render_plan_from_blueprint(
            domain=domain,
            goal_text=goal_text,
            description=description,
            deadline=deadline,
            busy_windows=busy_windows,
            blueprint=rendered_blueprint,
        )

    def describe_status(self) -> PlanningRuntimeStatus:
        return PlanningRuntimeStatus(
            name="Google ADK",
            status="ready" if self.settings.is_google_adk_runtime else "disabled",
            detail=(
                f"Configured to use Gemini model {self.settings.adk_model} "
                "through the Google ADK runtime."
            ),
        )

    async def _generate_blueprint(
        self,
        goal_text: str,
        description: str | None,
    ) -> AdkPlanEnvelope:
        try:
            from google.adk.agents import LlmAgent
            from google.adk.planners import PlanReActPlanner
            from google.adk.runners import Runner
            from google.adk.sessions import InMemorySessionService
            from google.genai import types
        except ImportError as exc:
            raise RuntimeError(
                "Google ADK runtime requires `google-adk` and its transitive "
                "Gemini dependencies."
            ) from exc

        planner_agent = LlmAgent(
            name="telova_planning_agent",
            model=self.settings.adk_model,
            planner=PlanReActPlanner(),
            output_schema=AdkPlanEnvelope,
            instruction=(
                "You are Telova's planning agent. Convert the user's goal into "
                "a dependency-aware execution blueprint. Return only valid JSON "
                "that matches the output schema. Use 4-8 tasks. Task keys must "
                "be short snake_case identifiers. Dependencies may only point to "
                "earlier task keys."
            ),
            description="Builds a structured blueprint for Telova goal execution.",
        )

        session_service = InMemorySessionService()
        session_id = f"telova-plan-{uuid4()}"
        await session_service.create_session(
            app_name=self.settings.adk_app_name,
            user_id="telova",
            session_id=session_id,
        )

        runner = Runner(
            agent=planner_agent,
            app_name=self.settings.adk_app_name,
            session_service=session_service,
        )

        prompt = self._build_prompt(goal_text, description)
        user_content = types.Content(
            role="user",
            parts=[types.Part(text=prompt)],
        )

        final_response = ""
        async for event in runner.run_async(
            user_id="telova",
            session_id=session_id,
            new_message=user_content,
        ):
            if event.is_final_response() and event.content and event.content.parts:
                final_response = event.content.parts[0].text or ""

        if not final_response:
            raise RuntimeError("Google ADK did not return a final planning response.")

        return AdkPlanEnvelope.model_validate_json(final_response)

    def _build_prompt(self, goal_text: str, description: str | None) -> str:
        fallback_domain = self.goal_decomposer.classify_goal(goal_text)
        return (
            "Build a Telova execution blueprint for the following goal.\n\n"
            f"Goal: {goal_text}\n"
            f"Context: {description or 'No extra context provided.'}\n"
            f"Suggested domain: {fallback_domain}\n\n"
            "Requirements:\n"
            "- Use domains like career_growth, product_launch, "
            "skill_acceleration, or generic_execution.\n"
            "- Provide 4 to 8 tasks.\n"
            "- Each task must include title, description, phase, "
            "estimated_minutes, depends_on, and milestone.\n"
            "- Make dependencies acyclic.\n"
            "- At least one task must be a milestone.\n"
            "- The final milestone should represent delivery, review, or outcome capture.\n"
            "- Return JSON only.\n"
        )

    def _coerce_blueprint_tasks(
        self,
        tasks: list[AdkBlueprintTask],
    ) -> list[BlueprintTask]:
        normalized: list[BlueprintTask] = []
        seen_keys: set[str] = set()

        for index, task in enumerate(tasks):
            safe_key = task.key.strip().lower().replace("-", "_")
            if safe_key in seen_keys or not safe_key:
                safe_key = f"task_{index + 1}"
            seen_keys.add(safe_key)

            depends_on = tuple(
                dependency
                for dependency in task.depends_on
                if dependency in seen_keys and dependency != safe_key
            )
            normalized.append(
                BlueprintTask(
                    key=safe_key,
                    title=task.title.strip(),
                    description=task.description.strip(),
                    phase=task.phase.strip().lower(),
                    estimated_minutes=task.estimated_minutes,
                    depends_on=depends_on,
                    milestone=task.milestone,
                )
            )

        if normalized and not any(task.milestone for task in normalized):
            normalized[0] = BlueprintTask(
                key=normalized[0].key,
                title=normalized[0].title,
                description=normalized[0].description,
                phase=normalized[0].phase,
                estimated_minutes=normalized[0].estimated_minutes,
                depends_on=normalized[0].depends_on,
                milestone=True,
            )

        return normalized
