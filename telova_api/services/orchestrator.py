from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import asyncio
import inspect

from telova_api.agents.conflict_sentinel import ConflictAlert, ConflictSentinelAgent
from telova_api.agents.context_bridge import ContextBridgeAgent
from telova_api.agents.progress_adaptor import ProgressAdaptorAgent
from telova_api.config import Settings
from telova_api.integrations.calendar import DatabaseCalendarGateway
from telova_api.integrations.notes import DatabaseNotesGateway
from telova_api.integrations.tasks import DatabaseTaskGateway
from telova_api.models import AgentRun, Goal, ReplanEvent, Task
from telova_api.repositories.analytics import AgentRunRepository, McpSyncLogRepository
from telova_api.repositories.calendar import CalendarEventRepository
from telova_api.repositories.goals import GoalRepository
from telova_api.repositories.notes import NoteRepository
from telova_api.repositories.tasks import TaskRepository
from telova_api.schemas import GoalCreateRequest
from telova_api.services.data_analyst import ProductivityDataAnalystService
from telova_api.services.planning_runtime import (
    DeterministicPlanningRuntime,
    GoogleAdkPlanningRuntime,
)
from telova_api.services.scheduling import BusyWindow
from telova_api.vectorizer import embed_text


@dataclass(frozen=True)
class ConflictScanResult:
    alerts: list[ConflictAlert]


class TelovaOrchestratorService:
    def __init__(
        self,
        *,
        settings: Settings,
        goal_repo: GoalRepository,
        task_repo: TaskRepository,
        calendar_repo: CalendarEventRepository,
        note_repo: NoteRepository,
        agent_run_repo: AgentRunRepository,
        sync_log_repo: McpSyncLogRepository,
        task_gateway: DatabaseTaskGateway,
        calendar_gateway: DatabaseCalendarGateway,
        notes_gateway: DatabaseNotesGateway,
        data_analyst: ProductivityDataAnalystService,
        planning_runtime: DeterministicPlanningRuntime | GoogleAdkPlanningRuntime,
        conflict_sentinel: ConflictSentinelAgent,
        context_bridge: ContextBridgeAgent,
        progress_adaptor: ProgressAdaptorAgent,
        auto_resolve_conflicts: bool,
    ) -> None:
        self.settings = settings
        self.goal_repo = goal_repo
        self.task_repo = task_repo
        self.calendar_repo = calendar_repo
        self.note_repo = note_repo
        self.agent_run_repo = agent_run_repo
        self.sync_log_repo = sync_log_repo
        self.task_gateway = task_gateway
        self.calendar_gateway = calendar_gateway
        self.notes_gateway = notes_gateway
        self.data_analyst = data_analyst
        self.planning_runtime = planning_runtime
        self.conflict_sentinel = conflict_sentinel
        self.context_bridge = context_bridge
        self.progress_adaptor = progress_adaptor
        self.auto_resolve_conflicts = auto_resolve_conflicts

    async def preview_goal_plan(self, request: GoalCreateRequest) -> dict:
        planning_description = self._compose_planning_description(request)
        existing_events = await self.calendar_gateway.list_all(user_id=request.user_id)
        plan_result = self.planning_runtime.build_plan(
            goal_text=request.goal,
            description=planning_description,
            deadline=request.deadline,
            detailed_plan_text=request.detailed_plan_text,
            busy_windows=[
                BusyWindow(start_at=event.start_at, end_at=event.end_at)
                for event in existing_events
            ],
        )
        plan = await plan_result if inspect.isawaitable(plan_result) else plan_result
        preview = {
            "domain": plan.domain,
            "deadline": plan.deadline,
            "summary": self._build_preview_summary(request, plan),
            "dag": plan.dag,
            "tasks": plan.tasks,
        }
        await self._record_agent_run(
            user_id=request.user_id,
            goal_id=None,
            agent_name="Research",
            operation="preview_goal_plan",
            runtime=self.settings.agent_runtime,
            input_payload={
                "goal": request.goal,
                "priority": request.priority,
                "constraints": request.constraints,
            },
            output_payload={
                "domain": preview["domain"],
                "task_count": len(preview["tasks"]),
            },
        )
        return preview

    async def create_goal_plan(self, request: GoalCreateRequest) -> tuple[Goal, dict, list[Task], list]:
        planning_description = self._compose_planning_description(request)
        existing_events = await self.calendar_gateway.list_all(user_id=request.user_id)
        plan_result = self.planning_runtime.build_plan(
            goal_text=request.goal,
            description=planning_description,
            deadline=request.deadline,
            detailed_plan_text=request.detailed_plan_text,
            busy_windows=[
                BusyWindow(start_at=event.start_at, end_at=event.end_at)
                for event in existing_events
            ],
        )
        plan = await plan_result if inspect.isawaitable(plan_result) else plan_result

        goal = await self.goal_repo.create(
            Goal(
                user_id=request.user_id,
                title=request.goal,
                description=planning_description,
                domain=plan.domain,
                deadline=plan.deadline,
                dag_json={},
            )
        )

        tasks = await self.task_repo.create_many(
            [
                Task(
                    goal_id=goal.id,
                    user_id=request.user_id,
                    title=task["title"],
                    description=task["description"],
                    phase=task["phase"],
                    status="pending",
                    depends_on=task["depends_on"],
                    estimated_minutes=task["estimated_minutes"],
                    scheduled_start=task["scheduled_start"],
                    scheduled_end=task["scheduled_end"],
                    embedding=embed_text(
                        f'{request.goal} {task["title"]} {task["description"]}'
                    ),
                    order_index=task["order_index"],
                )
                for task in plan.tasks
            ]
        )

        key_to_task_id = {
            task_blueprint["key"]: task.id
            for task_blueprint, task in zip(plan.tasks, tasks, strict=False)
        }
        for task_blueprint, task in zip(plan.tasks, tasks, strict=False):
            task.depends_on = [
                key_to_task_id[key]
                for key in task_blueprint["depends_on"]
                if key in key_to_task_id
            ]
            await self.task_repo.save(task)

        events = []
        for task in tasks:
            event = await self.calendar_gateway.materialize_task_block(goal, task)
            task.calendar_event_id = event.id
            await self.task_repo.save(task)
            events.append(event)

        await self.task_gateway.sync_generated_tasks(goal, tasks)
        goal.dag_json = self._hydrate_dag(plan.dag, tasks)
        await self.goal_repo.save(goal)
        await self.notes_gateway.create_status_report(
            user_id=goal.user_id,
            goal_id=goal.id,
            title=f"Goal activated: {goal.title}",
            content=self._build_activation_note(goal.title, tasks),
        )
        await self._record_agent_run(
            user_id=request.user_id,
            goal_id=goal.id,
            agent_name="Orchestrator",
            operation="create_goal_plan",
            runtime=self.settings.agent_runtime,
            input_payload={
                "goal": request.goal,
                "priority": request.priority,
                "constraints": request.constraints,
            },
            output_payload={
                "task_count": len(tasks),
                "calendar_event_count": len(events),
                "domain": goal.domain,
            },
        )
        return goal, goal.dag_json, tasks, events

    async def list_goals(self, user_id: str) -> list[Goal]:
        return await self.goal_repo.list_by_user(user_id)

    async def get_goal(self, goal_id: str) -> Goal | None:
        return await self.goal_repo.get(goal_id)

    async def get_goal_dag(self, goal_id: str) -> dict | None:
        goal = await self.goal_repo.get(goal_id)
        return goal.dag_json if goal else None

    async def get_goal_tasks(self, goal_id: str) -> list[Task]:
        return await self.task_gateway.list_goal_tasks(goal_id)

    async def update_task_status(
        self,
        task_id: str,
        status: str,
        *,
        user_id: str | None = None,
    ) -> Task | None:
        task = await self.task_repo.get(task_id)
        if task is None:
            return None
        if user_id is not None and task.user_id != user_id:
            return None
        return await self.task_gateway.update_status(task, status)

    async def create_external_calendar_event(
        self,
        *,
        user_id: str,
        title: str,
        description: str,
        start_at: datetime,
        end_at: datetime,
        goal_id: str | None = None,
        task_id: str | None = None,
    ):
        return await self.calendar_gateway.create_external_event(
            user_id=user_id,
            title=title,
            description=description,
            start_at=start_at,
            end_at=end_at,
            goal_id=goal_id,
            task_id=task_id,
        )

    async def list_calendar_events(self, user_id: str) -> list:
        return await self.calendar_gateway.list_all(user_id=user_id)

    async def search_tasks(self, user_id: str, query: str, limit: int = 5) -> list[Task]:
        return await self.task_repo.search(user_id=user_id, query=query, limit=limit)

    async def list_tasks(self, user_id: str) -> list[Task]:
        return await self.task_gateway.list_user_tasks(user_id)

    async def list_notes(self, user_id: str, limit: int = 50) -> list:
        return await self.notes_gateway.list_user_notes(user_id, limit=limit)

    async def create_note(
        self,
        *,
        user_id: str,
        title: str,
        content: str,
        goal_id: str | None = None,
        note_type: str = "manual",
    ):
        return await self.notes_gateway.create_manual_note(
            user_id=user_id,
            title=title,
            content=content,
            goal_id=goal_id,
            note_type=note_type,
        )

    async def update_note(
        self,
        note_id: str,
        *,
        title: str | None = None,
        content: str | None = None,
        user_id: str | None = None,
    ):
        note = await self.note_repo.get(note_id)
        if note is None:
            return None
        if user_id is not None and note.user_id != user_id:
            return None
        return await self.notes_gateway.update_note(
            note,
            title=title,
            content=content,
        )

    async def describe_integrations(self, user_id: str) -> list[dict]:
        statuses = await asyncio.gather(
            self.calendar_gateway.describe_status(user_id),
            self.task_gateway.describe_status(user_id),
            self.notes_gateway.describe_status(user_id),
        )
        return [status.__dict__ for status in statuses]

    async def list_agent_runs(self, user_id: str, limit: int = 20) -> list[AgentRun]:
        return await self.agent_run_repo.list_by_user(user_id, limit=limit)

    async def list_sync_logs(self, user_id: str, limit: int = 50):
        return await self.sync_log_repo.list_by_user(user_id, limit=limit)

    async def query_productivity_data(
        self,
        *,
        user_id: str,
        question: str,
        limit: int = 10,
    ) -> dict:
        try:
            result = await self.data_analyst.answer_question(
                user_id=user_id,
                question=question,
                limit=limit,
            )
        except Exception as exc:
            await self._record_agent_run(
                user_id=user_id,
                goal_id=None,
                agent_name="Data Analyst",
                operation="analytics_query",
                runtime="failed",
                status="failed",
                input_payload={"question": question, "limit": limit},
                output_payload={"error": str(exc)},
            )
            raise

        await self._record_agent_run(
            user_id=user_id,
            goal_id=None,
            agent_name="Data Analyst",
            operation="analytics_query",
            runtime=result["execution_mode"],
            input_payload={"question": question, "limit": limit},
            output_payload={
                "row_count": result["row_count"],
                "source_objects": result["source_objects"],
            },
            sql_text=result["generated_sql"],
        )
        return result

    def describe_planning_runtime(self) -> dict:
        return self.planning_runtime.describe_status().__dict__

    def describe_data_analyst(self) -> dict:
        return self.data_analyst.describe_status()

    async def get_dashboard(self, user_id: str) -> dict:
        goals = await self.goal_repo.list_by_user(user_id)
        tasks = await self.task_gateway.list_user_tasks(user_id)
        events = await self.calendar_gateway.list_upcoming(user_id=user_id, hours_ahead=168)
        notes = await self.notes_gateway.list_user_notes(user_id, limit=10)
        return {
            "goals": goals,
            "recent_tasks": tasks[:12],
            "upcoming_events": events[:10],
            "notes": notes[:8],
        }

    async def switch_goal(
        self,
        *,
        from_goal_id: str,
        to_goal_id: str,
        user_id: str,
    ):
        from_goal = await self.goal_repo.get(from_goal_id)
        to_goal = await self.goal_repo.get(to_goal_id)
        if from_goal is None or to_goal is None:
            return None
        if from_goal.user_id != user_id or to_goal.user_id != user_id:
            return None

        from_tasks = await self.task_repo.list_by_goal(from_goal_id)
        to_tasks = await self.task_repo.list_by_goal(to_goal_id)
        package = self.context_bridge.build_context_package(
            from_goal=from_goal,
            to_goal=to_goal,
            from_tasks=from_tasks,
            to_tasks=to_tasks,
        )
        result = await self.notes_gateway.create_context_package(
            user_id=user_id,
            goal_id=to_goal.id,
            title=package.title,
            content=package.summary,
            from_goal_id=from_goal.id,
            to_goal_id=to_goal.id,
            open_items=package.open_items,
        )
        await self._record_agent_run(
            user_id=user_id,
            goal_id=to_goal.id,
            agent_name="Memory",
            operation="switch_goal_context",
            runtime="context_bridge",
            input_payload={
                "from_goal_id": from_goal.id,
                "to_goal_id": to_goal.id,
            },
            output_payload={
                "open_item_count": len(package.open_items),
                "summary": package.summary[:160],
            },
        )
        return result

    async def run_conflict_scan(
        self,
        *,
        user_id: str | None = None,
        auto_resolve: bool | None = None,
    ) -> list[ConflictAlert]:
        goals = await self.goal_repo.list_active(user_id=user_id)
        should_auto_resolve = (
            self.auto_resolve_conflicts if auto_resolve is None else auto_resolve
        )
        alerts: list[ConflictAlert] = []

        for goal in goals:
            tasks = await self.task_repo.list_by_goal(goal.id)
            system_events = await self.calendar_gateway.list_upcoming(
                user_id=goal.user_id,
                hours_ahead=72,
                source="system",
                goal_id=goal.id,
            )
            external_events = await self.calendar_gateway.list_upcoming(
                user_id=goal.user_id,
                hours_ahead=72,
                source="external",
            )
            goal_alerts = self.conflict_sentinel.inspect(
                goal_id=goal.id,
                tasks=tasks,
                system_events=system_events,
                external_events=external_events,
            )
            if should_auto_resolve:
                for alert in goal_alerts:
                    if alert.suggested_start is None or alert.suggested_end is None:
                        continue
                    task = await self.task_repo.get(alert.task_id)
                    event = await self.calendar_repo.get(alert.task_event_id)
                    if task is None or event is None:
                        continue
                    await self.calendar_gateway.reschedule_task_block(
                        event,
                        start_at=alert.suggested_start,
                        end_at=alert.suggested_end,
                        reason="Automatic resolution from conflict sentinel.",
                    )
                    task.scheduled_start = alert.suggested_start
                    task.scheduled_end = alert.suggested_end
                    await self.task_repo.save(task)
                goal_alerts = [
                    ConflictAlert(
                        **{**alert.__dict__, "auto_resolved": bool(alert.suggested_start)}
                    )
                    for alert in goal_alerts
                ]
            alerts.extend(goal_alerts)

        await self._record_agent_run(
            user_id=user_id or "all-users",
            goal_id=None,
            agent_name="Scheduler",
            operation="conflict_scan",
            runtime="conflict_sentinel",
            input_payload={"auto_resolve": should_auto_resolve},
            output_payload={"alert_count": len(alerts)},
        )
        return alerts

    async def run_weekly_review(
        self,
        *,
        user_id: str | None = None,
    ) -> list[dict]:
        goals = await self.goal_repo.list_active(user_id=user_id)
        reviews: list[dict] = []

        for goal in goals:
            tasks = await self.task_repo.list_by_goal(goal.id)
            events = await self.calendar_gateway.list_all(user_id=goal.user_id, limit=250)
            review = self.progress_adaptor.review(goal=goal, tasks=tasks, events=events)
            goal.deviation = review.deviation_pct

            if review.replanned:
                old_dag = dict(goal.dag_json or {})
                updated_task_ids: list[str] = []
                for task_id, window in review.task_updates.items():
                    task = await self.task_repo.get(task_id)
                    if task is None:
                        continue
                    start_at, end_at = window
                    task.scheduled_start = start_at
                    task.scheduled_end = end_at
                    await self.task_repo.save(task)
                    updated_task_ids.append(task.id)
                    if task.calendar_event_id:
                        event = await self.calendar_repo.get(task.calendar_event_id)
                        if event is not None:
                            await self.calendar_gateway.reschedule_task_block(
                                event,
                                start_at=start_at,
                                end_at=end_at,
                                reason="Weekly review re-plan.",
                            )

                refreshed_tasks = await self.task_repo.list_by_goal(goal.id)
                goal.dag_json = self._rebuild_goal_dag(goal.dag_json, refreshed_tasks)
                await self.notes_gateway.create_replan_event(
                    ReplanEvent(
                        goal_id=goal.id,
                        deviation_pct=review.deviation_pct,
                        old_dag=old_dag,
                        new_dag=goal.dag_json,
                        summary=review.summary,
                    )
                )
                await self.notes_gateway.create_status_report(
                    user_id=goal.user_id,
                    goal_id=goal.id,
                    title=f"Weekly review: {goal.title}",
                    content=review.status_report,
                )
            else:
                updated_task_ids = []

            await self.goal_repo.save(goal)
            reviews.append(
                {
                    "goal_id": goal.id,
                    "deviation_pct": review.deviation_pct,
                    "replanned": review.replanned,
                    "summary": review.summary,
                    "updated_task_ids": updated_task_ids,
                }
            )

        await self._record_agent_run(
            user_id=user_id or "all-users",
            goal_id=None,
            agent_name="Execution",
            operation="weekly_review",
            runtime="progress_adaptor",
            input_payload={},
            output_payload={
                "review_count": len(reviews),
                "replanned_count": sum(1 for item in reviews if item["replanned"]),
            },
        )
        return reviews

    def _hydrate_dag(self, dag: dict, tasks: list[Task]) -> dict:
        key_to_task = {
            node["key"]: task
            for node, task in zip(dag.get("nodes", []), tasks, strict=False)
        }
        hydrated_nodes = []
        for node in dag.get("nodes", []):
            task = key_to_task[node["key"]]
            hydrated_nodes.append(
                {
                    **node,
                    "task_id": task.id,
                    "depends_on": task.depends_on,
                    "scheduled_start": self._serialize_datetime(task.scheduled_start),
                    "scheduled_end": self._serialize_datetime(task.scheduled_end),
                }
            )
        return {
            **dag,
            "goal_id": tasks[0].goal_id if tasks else None,
            "nodes": hydrated_nodes,
            "edges": [
                {
                    "from_node": key_to_task[edge["from_node"]].id,
                    "to_node": key_to_task[edge["to_node"]].id,
                }
                for edge in dag.get("edges", [])
                if edge["from_node"] in key_to_task and edge["to_node"] in key_to_task
            ],
            "milestones": [
                key_to_task[key].id
                for key in dag.get("milestones", [])
                if key in key_to_task
            ],
        }

    def _rebuild_goal_dag(self, dag: dict, tasks: list[Task]) -> dict:
        nodes_by_task_id = {node.get("task_id"): node for node in dag.get("nodes", [])}
        rebuilt_nodes = []
        for task in tasks:
            existing = nodes_by_task_id.get(task.id, {})
            rebuilt_nodes.append(
                {
                    **existing,
                    "task_id": task.id,
                    "key": existing.get("key", task.id),
                    "title": task.title,
                    "phase": task.phase,
                    "estimated_minutes": task.estimated_minutes,
                    "depends_on": task.depends_on,
                    "scheduled_start": self._serialize_datetime(task.scheduled_start),
                    "scheduled_end": self._serialize_datetime(task.scheduled_end),
                    "milestone": existing.get("milestone", False),
                }
            )
        return {**dag, "nodes": rebuilt_nodes}

    def _serialize_datetime(self, value: datetime | None) -> str | None:
        return value.isoformat() if value else None

    def _compose_planning_description(self, request: GoalCreateRequest) -> str | None:
        parts: list[str] = []
        if request.description:
            parts.append(request.description.strip())
        if request.priority:
            parts.append(f"Priority: {request.priority.strip()}.")
        if request.constraints:
            cleaned = [item.strip() for item in request.constraints if item.strip()]
            if cleaned:
                parts.append(f"Constraints: {'; '.join(cleaned)}.")
        return " ".join(parts).strip() or None

    def _build_preview_summary(self, request: GoalCreateRequest, plan) -> str:
        milestone_count = sum(1 for task in plan.tasks if task.get("milestone"))
        schedule_start = plan.tasks[0]["scheduled_start"] if plan.tasks else None
        schedule_end = plan.tasks[-1]["scheduled_end"] if plan.tasks else None
        pieces = [
            f'Telova prepared a {plan.domain.replace("_", " ")} plan for "{request.goal}".',
            f"It contains {len(plan.tasks)} tasks and {milestone_count} milestones.",
        ]
        if request.priority:
            pieces.append(f"Priority is set to {request.priority}.")
        if schedule_start and schedule_end:
            pieces.append(
                "The proposed execution window runs from "
                f"{schedule_start.strftime('%b %d, %Y %I:%M %p')} to "
                f"{schedule_end.strftime('%b %d, %Y %I:%M %p')}."
            )
        return " ".join(pieces)

    def _build_activation_note(self, goal_title: str, tasks: list[Task]) -> str:
        if not tasks:
            return f'Telova activated the goal "{goal_title}".'

        first_task = tasks[0]
        last_task = tasks[-1]
        milestones = [task.title for task in tasks if "delivery" in task.phase or "planning" in task.phase][:3]
        lines = [
            f'Telova activated "{goal_title}".',
            f"{len(tasks)} tasks were created and synced to the execution system.",
            (
                "Initial execution window: "
                f"{first_task.scheduled_start.strftime('%b %d, %Y %I:%M %p')} to "
                f"{last_task.scheduled_end.strftime('%b %d, %Y %I:%M %p')}."
            ),
        ]
        if milestones:
            lines.append(f"Key checkpoints: {', '.join(milestones)}.")
        return " ".join(lines)

    async def _record_agent_run(
        self,
        *,
        user_id: str,
        goal_id: str | None,
        agent_name: str,
        operation: str,
        runtime: str,
        input_payload: dict,
        output_payload: dict,
        status: str = "completed",
        sql_text: str | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        await self.agent_run_repo.create(
            AgentRun(
                user_id=user_id,
                goal_id=goal_id,
                agent_name=agent_name,
                operation=operation,
                status=status,
                runtime=runtime,
                input_payload=input_payload,
                output_payload=output_payload,
                sql_text=sql_text,
                started_at=now,
                completed_at=now,
            )
        )

