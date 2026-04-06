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
from telova_api.logging_utils import configure_logging
from telova_api.monitoring import configure_monitoring
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
    NoteCreateRequest,
    NoteRead,
    NoteUpdateRequest,
    ReadinessCheckRead,
    SystemMetricRead,
    SystemStatusRead,
    TaskRead,
    TaskUpdateRequest,
    ToolConnectionRead,
    WeeklyReviewResponse,
    WorkflowLogRead,
)
from telova_api.security import (
    ApiAuthMiddleware,
    RateLimitMiddleware,
    RequestContextMiddleware,
    StructuredAccessLogMiddleware,
)
from telova_api.secrets import SecretResolver
from telova_api.services.factory import build_orchestrator


settings = get_settings()
configure_logging(settings)
configure_monitoring(settings)
secret_resolver = SecretResolver(settings)
api_key = secret_resolver.resolve_text(
    inline_value=settings.api_key,
    secret_name=settings.api_key_secret,
    label="API key",
)
cron_token = secret_resolver.resolve_text(
    inline_value=settings.cron_shared_token,
    secret_name=settings.cron_shared_token_secret,
    label="cron token",
)
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
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    StructuredAccessLogMiddleware,
)
app.add_middleware(
    ApiAuthMiddleware,
    auth_mode=settings.api_auth_mode,
    api_key=api_key,
    cron_token=cron_token,
)
app.add_middleware(
    RateLimitMiddleware,
    enabled=settings.rate_limit_enabled,
    limit=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window_seconds,
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


@app.post("/api/v1/notes", response_model=NoteRead)
async def create_note(
    payload: NoteCreateRequest,
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.create_note(
        user_id=payload.user_id,
        title=payload.title,
        content=payload.content,
        goal_id=payload.goal_id,
        note_type=payload.note_type,
    )


@app.patch("/api/v1/notes/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: str,
    payload: NoteUpdateRequest,
    orchestrator=Depends(get_orchestrator),
):
    note = await orchestrator.update_note(
        note_id,
        title=payload.title,
        content=payload.content,
    )
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note


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
    integration_statuses = await orchestrator.describe_integrations(user_id)
    planning_runtime = orchestrator.describe_planning_runtime()

    alloydb_ready = bool(
        settings.alloydb_instance_name
        and settings.alloydb_database
        and settings.alloydb_user
        and (
            settings.alloydb_password
            or settings.alloydb_password_secret
            or settings.alloydb_enable_iam_auth
        )
    )
    postgres_ready = settings.database_url.startswith("postgresql")
    workspace_auth_ready = bool(
        settings.is_google_backend
        and settings.google_workspace_auth_mode != "disabled"
    )
    secret_manager_ready = bool(
        settings.use_secret_manager and settings.gcp_project_id
    )
    adk_ready = bool(
        not settings.is_google_adk_runtime
        or (settings.adk_model and settings.agent_runtime == "google_adk")
    )
    scheduler_ready = bool(settings.scheduler_ready and (cron_token or api_key))

    return SystemStatusRead(
        app=settings.app_name,
        environment=settings.app_env,
        database=database_label,
        runtime_mode=runtime_mode,
        orchestration_runtime=settings.agent_runtime,
        integration_backend=settings.integration_backend,
        auth_mode=settings.api_auth_mode,
        rate_limit=(
            f"{settings.rate_limit_requests}/{settings.rate_limit_window_seconds}s"
            if settings.rate_limit_enabled
            else "disabled"
        ),
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
                detail=planning_runtime["detail"],
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
                status=planning_runtime["status"],
                detail=(
                    "Gemini-powered planning is enabled."
                    if settings.is_google_adk_runtime
                    else "Turning high-level goals into dependency-aware plans."
                ),
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
            *[
                ToolConnectionRead(
                    name=item["name"],
                    kind=item["kind"],
                    status=item["status"],
                    detail=item["detail"],
                )
                for item in integration_statuses
            ],
            ToolConnectionRead(
                name="Database",
                kind="Persistence",
                status="connected",
                detail=f"Running in {runtime_mode} mode against {database_label}.",
            ),
            ToolConnectionRead(
                name="Secret Manager",
                kind="Credentials",
                status="connected" if secret_manager_ready else "warning",
                detail=(
                    "Runtime secret resolution is enabled."
                    if secret_manager_ready
                    else "Secrets are expected from plain env vars or mounted files."
                ),
            ),
            ToolConnectionRead(
                name="Cloud Scheduler",
                kind="Automation",
                status="connected" if scheduler_ready else "warning",
                detail=(
                    "Conflict scan and weekly review schedules are configured."
                    if scheduler_ready
                    else "Cron jobs are not fully configured for production yet."
                ),
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
        readiness=[
            ReadinessCheckRead(
                name="AlloyDB",
                status="ready" if alloydb_ready else "pending",
                detail=(
                    "AlloyDB connector variables are configured."
                    if alloydb_ready
                    else "Set AlloyDB instance, database, user, and password or IAM auth."
                ),
            ),
            ReadinessCheckRead(
                name="PostgreSQL URL",
                status="ready" if postgres_ready else "pending",
                detail=(
                    "DATABASE_URL points at PostgreSQL."
                    if postgres_ready
                    else "DATABASE_URL is still local or unset for PostgreSQL."
                ),
            ),
            ReadinessCheckRead(
                name="Google Workspace Auth",
                status="ready" if workspace_auth_ready else "pending",
                detail=(
                    "Workspace auth is configured for Calendar/Tasks/Keep."
                    if workspace_auth_ready
                    else "Enable GOOGLE_WORKSPACE_AUTH_MODE and provide credentials."
                ),
            ),
            ReadinessCheckRead(
                name="Google ADK Runtime",
                status="ready" if adk_ready else "pending",
                detail=(
                    f"Agent runtime is set to {settings.agent_runtime}."
                    if adk_ready
                    else "Provide ADK model settings and install google-adk."
                ),
            ),
            ReadinessCheckRead(
                name="Secret Manager",
                status="ready" if secret_manager_ready else "pending",
                detail=(
                    "Secret Manager is enabled with a GCP project id."
                    if secret_manager_ready
                    else "Secrets are still expected directly from environment variables."
                ),
            ),
            ReadinessCheckRead(
                name="Cloud Scheduler",
                status="ready" if scheduler_ready else "pending",
                detail=(
                    "Recurring conflict scan and weekly review automation is configured."
                    if scheduler_ready
                    else "Configure Cloud Scheduler URL, service account, schedules, and cron token."
                ),
            ),
        ],
    )

