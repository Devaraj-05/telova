from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from telova_api.agents.conflict_sentinel import ConflictAlert, ConflictSentinelAgent
from telova_api.agents.context_bridge import ContextBridgeAgent
from telova_api.agents.goal_decomposer import GoalDecomposerAgent
from telova_api.agents.progress_adaptor import ProgressAdaptorAgent
from telova_api.integrations.calendar import DatabaseCalendarGateway
from telova_api.integrations.notes import DatabaseNotesGateway
from telova_api.integrations.tasks import DatabaseTaskGateway
from telova_api.models import Goal, ReplanEvent, Task
from telova_api.repositories.calendar import CalendarEventRepository
from telova_api.repositories.goals import GoalRepository
from telova_api.repositories.notes import NoteRepository
from telova_api.repositories.tasks import TaskRepository
from telova_api.schemas import GoalCreateRequest
from telova_api.services.scheduling import BusyWindow
from telova_api.vectorizer import embed_text


@dataclass(frozen=True)
class ConflictScanResult:
    alerts: list[ConflictAlert]


class TelovaOrchestratorService:
    def __init__(
        self,
        *,
        goal_repo: GoalRepository,
        task_repo: TaskRepository,
        calendar_repo: CalendarEventRepository,
        note_repo: NoteRepository,
        task_gateway: DatabaseTaskGateway,
        calendar_gateway: DatabaseCalendarGateway,
        notes_gateway: DatabaseNotesGateway,
        goal_decomposer: GoalDecomposerAgent,
        conflict_sentinel: ConflictSentinelAgent,
        context_bridge: ContextBridgeAgent,
        progress_adaptor: ProgressAdaptorAgent,
        auto_resolve_conflicts: bool,
    ) -> None:
        self.goal_repo = goal_repo
        self.task_repo = task_repo
        self.calendar_repo = calendar_repo
        self.note_repo = note_repo
        self.task_gateway = task_gateway
        self.calendar_gateway = calendar_gateway
        self.notes_gateway = notes_gateway
        self.goal_decomposer = goal_decomposer
        self.conflict_sentinel = conflict_sentinel
        self.context_bridge = context_bridge
        self.progress_adaptor = progress_adaptor
        self.auto_resolve_conflicts = auto_resolve_conflicts

    async def create_goal_plan(self, request: GoalCreateRequest) -> tuple[Goal, dict, list[Task], list]:
        existing_events = await self.calendar_gateway.list_all(user_id=request.user_id)
        plan = self.goal_decomposer.build_plan(
            goal_text=request.goal,
            description=request.description,
            deadline=request.deadline,
            busy_windows=[
                BusyWindow(start_at=event.start_at, end_at=event.end_at)
                for event in existing_events
            ],
        )

        goal = await self.goal_repo.create(
            Goal(
                user_id=request.user_id,
                title=request.goal,
                description=request.description,
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

        goal.dag_json = self._hydrate_dag(plan.dag, tasks)
        await self.goal_repo.save(goal)
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

    async def update_task_status(self, task_id: str, status: str) -> Task | None:
        task = await self.task_repo.get(task_id)
        if task is None:
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

    async def get_dashboard(self, user_id: str) -> dict:
        goals = await self.goal_repo.list_by_user(user_id)
        tasks = await self.task_repo.list_by_user(user_id)
        events = await self.calendar_gateway.list_upcoming(user_id=user_id, hours_ahead=168)
        notes = await self.note_repo.list_by_user(user_id, limit=10)
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

        from_tasks = await self.task_repo.list_by_goal(from_goal_id)
        to_tasks = await self.task_repo.list_by_goal(to_goal_id)
        package = self.context_bridge.build_context_package(
            from_goal=from_goal,
            to_goal=to_goal,
            from_tasks=from_tasks,
            to_tasks=to_tasks,
        )
        return await self.notes_gateway.create_context_package(
            user_id=user_id,
            goal_id=to_goal.id,
            title=package.title,
            content=package.summary,
            from_goal_id=from_goal.id,
            to_goal_id=to_goal.id,
            open_items=package.open_items,
        )

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

