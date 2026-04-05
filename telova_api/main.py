from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.config import get_settings
from telova_api.db import close_db, get_session, init_db
from telova_api.schemas import (
    AgentHealthRead,
    CalendarEventCreateRequest,
    CalendarEventRead,
    ConflictAlertRead,
    ContextPackageRead,
    CronRequest,
    DashboardRead,
    GoalCreateRequest,
    GoalDagResponse,
    GoalPlanResponse,
    GoalRead,
    GoalSwitchRequest,
    NoteRead,
    SystemMetricRead,
    SystemStatusRead,
    TaskRead,
    TaskUpdateRequest,
    ToolConnectionRead,
    WeeklyReviewResponse,
    WorkflowLogRead,
)
from telova_api.services.factory import build_orchestrator


settings = get_settings()
STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    description="Telova proactive goal-to-execution orchestrator.",
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


async def get_orchestrator(session: AsyncSession = Depends(get_session)):
    return build_orchestrator(session)


@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/v1/dashboard", response_model=DashboardRead)
async def dashboard(
    user_id: str = Query(default=settings.default_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.get_dashboard(user_id)


@app.get("/api/v1/goals", response_model=list[GoalRead])
async def list_goals(
    user_id: str = Query(default=settings.default_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_goals(user_id)


@app.post("/api/v1/goals", response_model=GoalPlanResponse)
async def create_goal(
    payload: GoalCreateRequest,
    orchestrator=Depends(get_orchestrator),
):
    goal, dag, tasks, events = await orchestrator.create_goal_plan(payload)
    return GoalPlanResponse(
        goal=GoalRead.model_validate(goal),
        dag=GoalDagResponse.model_validate(dag),
        tasks=[TaskRead.model_validate(task) for task in tasks],
        calendar_events=[
            CalendarEventRead.model_validate(event) for event in events
        ],
    )


@app.get("/api/v1/goals/{goal_id}", response_model=GoalRead)
async def get_goal(goal_id: str, orchestrator=Depends(get_orchestrator)):
    goal = await orchestrator.get_goal(goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return goal


@app.get("/api/v1/goals/{goal_id}/dag", response_model=GoalDagResponse)
async def get_goal_dag(goal_id: str, orchestrator=Depends(get_orchestrator)):
    dag = await orchestrator.get_goal_dag(goal_id)
    if dag is None:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return GoalDagResponse.model_validate(dag)


@app.get("/api/v1/goals/{goal_id}/tasks", response_model=list[TaskRead])
async def list_goal_tasks(goal_id: str, orchestrator=Depends(get_orchestrator)):
    return await orchestrator.get_goal_tasks(goal_id)


@app.post("/api/v1/goals/{goal_id}/switch")
async def switch_goal(
    goal_id: str,
    payload: GoalSwitchRequest,
    orchestrator=Depends(get_orchestrator),
):
    result = await orchestrator.switch_goal(
        from_goal_id=goal_id,
        to_goal_id=payload.target_goal_id,
        user_id=payload.user_id,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="One or both goals were not found.")
    note, context_package = result
    return {
        "note": NoteRead.model_validate(note),
        "context_package": ContextPackageRead.model_validate(context_package),
    }


@app.patch("/api/v1/tasks/{task_id}", response_model=TaskRead)
async def update_task_status(
    task_id: str,
    payload: TaskUpdateRequest,
    orchestrator=Depends(get_orchestrator),
):
    task = await orchestrator.update_task_status(task_id, payload.status)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@app.get("/api/v1/tasks/search", response_model=list[TaskRead])
async def search_tasks(
    q: str,
    user_id: str = Query(default=settings.default_user_id),
    limit: int = Query(default=5, ge=1, le=20),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.search_tasks(user_id=user_id, query=q, limit=limit)


@app.get("/api/v1/tasks", response_model=list[TaskRead])
async def list_tasks(
    user_id: str = Query(default=settings.default_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_tasks(user_id)


@app.get("/api/v1/notes", response_model=list[NoteRead])
async def list_notes(
    user_id: str = Query(default=settings.default_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_notes(user_id)


@app.get("/api/v1/calendar/events", response_model=list[CalendarEventRead])
async def list_calendar_events(
    user_id: str = Query(default=settings.default_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_calendar_events(user_id)


@app.post("/api/v1/calendar/events", response_model=CalendarEventRead)
async def create_calendar_event(
    payload: CalendarEventCreateRequest,
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.create_external_calendar_event(
        user_id=payload.user_id,
        title=payload.title,
        description=payload.description,
        start_at=payload.start_at,
        end_at=payload.end_at,
        goal_id=payload.goal_id,
        task_id=payload.task_id,
    )


@app.post("/api/v1/webhooks/cron/conflict-check", response_model=list[ConflictAlertRead])
async def conflict_check(
    payload: CronRequest,
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.run_conflict_scan(
        user_id=payload.user_id,
        auto_resolve=payload.auto_resolve,
    )


@app.post("/api/v1/webhooks/cron/weekly-review", response_model=list[WeeklyReviewResponse])
async def weekly_review(
    payload: CronRequest,
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.run_weekly_review(user_id=payload.user_id)


@app.get("/api/v1/system/status", response_model=SystemStatusRead)
async def system_status(
    user_id: str = Query(default=settings.default_user_id),
    orchestrator=Depends(get_orchestrator),
):
    goals = await orchestrator.list_goals(user_id)
    tasks = await orchestrator.list_tasks(user_id)
    notes = await orchestrator.list_notes(user_id)
    events = await orchestrator.list_calendar_events(user_id)

    workflow_notes = notes[:6]
    runtime_mode = (
        "alloydb-connector"
        if settings.alloydb_instance_name
        else "database-url"
        if settings.database_url.startswith("postgresql")
        else "sqlite-local"
    )
    database_label = (
        settings.alloydb_database
        or settings.database_url.rsplit("/", maxsplit=1)[-1]
    )

    return SystemStatusRead(
        app=settings.app_name,
        environment=settings.app_env,
        database=database_label,
        runtime_mode=runtime_mode,
        status="healthy",
        last_updated=datetime.now(timezone.utc),
        metrics=[
            SystemMetricRead(label="Goals", value=len(goals), tone="info"),
            SystemMetricRead(label="Tasks", value=len(tasks), tone="brand"),
            SystemMetricRead(label="Events", value=len(events), tone="warning"),
            SystemMetricRead(label="Notes", value=len(notes), tone="success"),
        ],
        agents=[
            AgentHealthRead(
                name="Orchestrator",
                role="Primary coordinator",
                status="active",
                detail="Routing planning, scheduling, and adaptation workflows.",
                load_label=f"{max(len(goals), 1)} goal lanes",
            ),
            AgentHealthRead(
                name="Scheduler",
                role="Conflict sentinel",
                status="ready",
                detail="Watching the next 72 hours for task collisions.",
                load_label=f"{len(events)} events tracked",
            ),
            AgentHealthRead(
                name="Research",
                role="Goal decomposer",
                status="ready",
                detail="Turning high-level goals into dependency-aware plans.",
                load_label=f"{len(tasks)} task nodes",
            ),
            AgentHealthRead(
                name="Memory",
                role="Context bridge",
                status="ready",
                detail="Maintaining notes, context packages, and weekly summaries.",
                load_label=f"{len(notes)} memory items",
            ),
            AgentHealthRead(
                name="Execution",
                role="Progress adaptor",
                status="monitoring",
                detail="Evaluating task completion and re-plan thresholds.",
                load_label=f"{sum(1 for task in tasks if task.status == 'done')} completed",
            ),
        ],
        connections=[
            ToolConnectionRead(
                name="Calendar",
                kind="MCP tool",
                status="connected",
                detail="DB-backed calendar adapter is online.",
            ),
            ToolConnectionRead(
                name="Tasks",
                kind="MCP tool",
                status="connected",
                detail="Task orchestration adapter is online.",
            ),
            ToolConnectionRead(
                name="Notes",
                kind="MCP tool",
                status="connected",
                detail="Notes and memory adapter is online.",
            ),
            ToolConnectionRead(
                name="Database",
                kind="Persistence",
                status="connected",
                detail=f"Running in {runtime_mode} mode against {database_label}.",
            ),
        ],
        workflows=[
            WorkflowLogRead(
                title=note.title,
                detail=note.content[:180],
                status=note.note_type,
                timestamp=note.created_at,
            )
            for note in workflow_notes
        ]
        or [
            WorkflowLogRead(
                title="No workflow logs yet",
                detail="Create a goal or run a weekly review to generate operational logs.",
                status="idle",
                timestamp=None,
            )
        ],
    )

