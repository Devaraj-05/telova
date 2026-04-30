from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.auth import get_current_user, get_optional_current_user
from telova_api.config import get_settings
from telova_api.db import close_db, get_session, init_db
from telova_api.logging_utils import configure_logging
from telova_api.monitoring import configure_monitoring
from telova_api.models import ChatSession
from telova_api.repositories.chat_sessions import ChatSessionRepository
from telova_api.repositories.google_connections import (
    GoogleWorkspaceConnectionRepository,
)
from telova_api.repositories.users import UserRepository
from telova_api.schemas import (
    AgentRunRead,
    AgentHealthRead,
    AnalyticsQueryRequest,
    AnalyticsQueryResponse,
    AuthResponse,
    CalendarEventCreateRequest,
    CalendarEventRead,
    ChatRequest,
    ChatResponse,
    ChatSessionCreateRequest,
    ChatSessionRead,
    ChatSessionUpdateRequest,
    WorkspaceChatRequest,
    WorkspaceChatResponse,
    ConflictAlertRead,
    ContextPackageRead,
    CronRequest,
    McpSyncLogRead,
    DashboardRead,
    GoogleAuthorizationUrlRead,
    GoogleConnectionStatusRead,
    GoalCreateRequest,
    GoalDagResponse,
    GoalPlanPreviewResponse,
    GoalPlanResponse,
    GoalPreviewTaskRead,
    GoalRead,
    GoalSwitchRequest,
    LoginRequest,
    NoteCreateRequest,
    NoteRead,
    NoteUpdateRequest,
    ReadinessCheckRead,
    SignupRequest,
    SystemMetricRead,
    SystemStatusRead,
    TaskRead,
    TaskUpdateRequest,
    ToolConnectionRead,
    UserRead,
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
from telova_api.services.auth_service import UserAuthService
from telova_api.services.chat_service import TelovaChatService
from telova_api.services.workspace_chat_service import WorkspaceChatService
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
# In Cloud Run, the frontend runs as a separate service. The static mount
# below is only used during local development when running `npm run build`
# with `output: "export"` (the out/ directory).
FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent / "out"


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
    auth_token_secret=settings.auth_token_secret,
)
app.add_middleware(
    RateLimitMiddleware,
    enabled=settings.rate_limit_enabled,
    limit=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window_seconds,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allow_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_orchestrator(session: AsyncSession = Depends(get_session)):
    return build_orchestrator(session)


async def resolve_user_id(
    user_id: str = Query(default=settings.default_user_id),
    current_user=Depends(get_optional_current_user),
) -> str:
    """Return the authenticated user's ID when a JWT is present; fall back to the
    ``user_id`` query param (defaults to ``DEFAULT_USER_ID``) for dev/demo flows
    where auth is disabled."""
    return current_user.id if current_user is not None else user_id


def ensure_owner(resource_user_id: str | None, user_id: str) -> None:
    if resource_user_id != user_id:
        raise HTTPException(status_code=404, detail="Resource not found.")


async def get_auth_service(session: AsyncSession = Depends(get_session)):
    return UserAuthService(
        settings=settings,
        secret_resolver=secret_resolver,
        user_repo=UserRepository(session),
        connection_repo=GoogleWorkspaceConnectionRepository(session),
    )


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}


@app.post("/api/v1/auth/chat", response_model=ChatResponse)
async def chat_with_agent(payload: ChatRequest):
    chat_service = TelovaChatService(settings)
    history = [{"role": msg.role, "content": msg.content} for msg in payload.history]
    reply = await chat_service.chat(user_message=payload.message, history=history)
    return ChatResponse(reply=reply)


@app.post("/api/v1/workspace/chat", response_model=WorkspaceChatResponse)
async def workspace_chat(
    payload: WorkspaceChatRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_optional_current_user),
):
    effective_user_id = current_user.id if current_user is not None else payload.user_id
    service = WorkspaceChatService(settings=settings, session=session)
    history = [{"role": msg.role, "content": msg.content} for msg in payload.history]
    result = await service.chat(
        user_id=effective_user_id,
        user_message=payload.message,
        history=history,
        goal_id=payload.goal_id,
    )
    return WorkspaceChatResponse(**result)


@app.post("/api/v1/auth/signup", response_model=AuthResponse)
async def signup(
    payload: SignupRequest,
    auth_service: UserAuthService = Depends(get_auth_service),
):
    user, access_token = await auth_service.signup(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    return AuthResponse(
        user=UserRead.model_validate(user),
        access_token=access_token,
    )


@app.post("/api/v1/auth/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    auth_service: UserAuthService = Depends(get_auth_service),
):
    user, access_token = await auth_service.login(
        email=payload.email,
        password=payload.password,
    )
    return AuthResponse(
        user=UserRead.model_validate(user),
        access_token=access_token,
    )


@app.get("/api/v1/auth/me", response_model=UserRead)
async def get_me(current_user=Depends(get_current_user)):
    return UserRead.model_validate(current_user)


@app.get("/api/v1/auth/google/start", response_model=GoogleAuthorizationUrlRead)
async def google_oauth_start(
    request: Request,
    mode: str = Query(default="login"),
    redirect_uri: str = Query(
        default=f"{settings.frontend_app_url.rstrip('/')}/auth/callback"
    ),
    include_keep: bool = Query(default=True),
    auth_service: UserAuthService = Depends(get_auth_service),
    current_user=Depends(get_optional_current_user),
):
    authorization_url = await auth_service.create_google_authorization_url(
        request=request,
        mode=mode,
        redirect_uri=redirect_uri,
        user=current_user,
        include_keep=include_keep,
    )
    return GoogleAuthorizationUrlRead(authorization_url=authorization_url)


@app.get(
    "/api/v1/auth/google/callback",
    include_in_schema=False,
    name="google_oauth_callback",
)
async def google_oauth_callback(
    request: Request,
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    auth_service: UserAuthService = Depends(get_auth_service),
):
    if error:
        redirect_url = auth_service.build_google_error_redirect(
            state_token=state,
            error=error,
            error_description=error_description,
        )
        if redirect_url:
            return RedirectResponse(url=redirect_url, status_code=302)
        raise HTTPException(status_code=400, detail=error_description or error)

    if not state:
        raise HTTPException(status_code=400, detail="Missing OAuth state.")

    try:
        redirect_url = await auth_service.complete_google_authorization(
            request=request,
            state_token=state,
        )
    except HTTPException as exc:
        error_redirect = auth_service.build_google_error_redirect(
            state_token=state,
            error="oauth_callback_failed",
            error_description=str(exc.detail),
        )
        if error_redirect:
            return RedirectResponse(url=error_redirect, status_code=302)
        raise
    except Exception as exc:
        error_redirect = auth_service.build_google_error_redirect(
            state_token=state,
            error="oauth_callback_failed",
            error_description=str(exc) or "Unexpected error during Google authorization.",
        )
        if error_redirect:
            return RedirectResponse(url=error_redirect, status_code=302)
        raise HTTPException(status_code=500, detail=str(exc))

    return RedirectResponse(url=redirect_url, status_code=302)


@app.get("/api/v1/auth/google/status", response_model=GoogleConnectionStatusRead)
async def google_connection_status(
    auth_service: UserAuthService = Depends(get_auth_service),
    current_user=Depends(get_current_user),
):
    status = await auth_service.google_connection_status(user=current_user)
    return GoogleConnectionStatusRead.model_validate(status)


@app.post("/api/v1/auth/google/disconnect")
async def google_disconnect(
    auth_service: UserAuthService = Depends(get_auth_service),
    current_user=Depends(get_current_user),
):
    await auth_service.disconnect_google_connection(user=current_user)
    return {"status": "disconnected"}


@app.get("/api/v1/dashboard", response_model=DashboardRead)
async def dashboard(
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.get_dashboard(user_id)


@app.get("/api/v1/goals", response_model=list[GoalRead])
async def list_goals(
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_goals(user_id)


@app.post("/api/v1/goals", response_model=GoalPlanResponse)
async def create_goal(
    payload: GoalCreateRequest,
    orchestrator=Depends(get_orchestrator),
    current_user=Depends(get_optional_current_user),
):
    if current_user is not None:
        payload = payload.model_copy(update={"user_id": current_user.id})
    goal, dag, tasks, events = await orchestrator.create_goal_plan(payload)
    return GoalPlanResponse(
        goal=GoalRead.model_validate(goal),
        dag=GoalDagResponse.model_validate(dag),
        tasks=[TaskRead.model_validate(task) for task in tasks],
        calendar_events=[
            CalendarEventRead.model_validate(event) for event in events
        ],
    )


@app.post("/api/v1/goals/preview", response_model=GoalPlanPreviewResponse)
async def preview_goal(
    payload: GoalCreateRequest,
    orchestrator=Depends(get_orchestrator),
    current_user=Depends(get_optional_current_user),
):
    if current_user is not None:
        payload = payload.model_copy(update={"user_id": current_user.id})
    preview = await orchestrator.preview_goal_plan(payload)
    runtime_status = orchestrator.describe_planning_runtime()
    return GoalPlanPreviewResponse(
        domain=preview["domain"],
        deadline=preview["deadline"],
        summary=preview["summary"],
        dag=GoalDagResponse.model_validate(preview["dag"]),
        tasks=[
            GoalPreviewTaskRead.model_validate(task)
            for task in preview["tasks"]
        ],
        planning_runtime=runtime_status.get("name", "Deterministic Planner"),
    )


@app.get("/api/v1/goals/{goal_id}", response_model=GoalRead)
async def get_goal(
    goal_id: str,
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    goal = await orchestrator.get_goal(goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found.")
    ensure_owner(goal.user_id, user_id)
    return goal


@app.get("/api/v1/goals/{goal_id}/dag", response_model=GoalDagResponse)
async def get_goal_dag(
    goal_id: str,
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    goal = await orchestrator.get_goal(goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found.")
    ensure_owner(goal.user_id, user_id)
    return GoalDagResponse.model_validate(goal.dag_json)


@app.get("/api/v1/goals/{goal_id}/tasks", response_model=list[TaskRead])
async def list_goal_tasks(
    goal_id: str,
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    goal = await orchestrator.get_goal(goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found.")
    ensure_owner(goal.user_id, user_id)
    return await orchestrator.get_goal_tasks(goal_id)


@app.post("/api/v1/goals/{goal_id}/switch")
async def switch_goal(
    goal_id: str,
    payload: GoalSwitchRequest,
    orchestrator=Depends(get_orchestrator),
    current_user=Depends(get_optional_current_user),
):
    effective_user_id = current_user.id if current_user is not None else payload.user_id
    result = await orchestrator.switch_goal(
        from_goal_id=goal_id,
        to_goal_id=payload.target_goal_id,
        user_id=effective_user_id,
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
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    task = await orchestrator.update_task_status(
        task_id,
        payload.status,
        user_id=user_id,
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@app.get("/api/v1/tasks/search", response_model=list[TaskRead])
async def search_tasks(
    q: str,
    user_id: str = Depends(resolve_user_id),
    limit: int = Query(default=5, ge=1, le=20),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.search_tasks(user_id=user_id, query=q, limit=limit)


@app.get("/api/v1/tasks", response_model=list[TaskRead])
async def list_tasks(
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_tasks(user_id)


@app.post("/api/v1/analytics/query", response_model=AnalyticsQueryResponse)
async def analytics_query(
    payload: AnalyticsQueryRequest,
    orchestrator=Depends(get_orchestrator),
    current_user=Depends(get_optional_current_user),
):
    effective_user_id = current_user.id if current_user is not None else payload.user_id
    result = await orchestrator.query_productivity_data(
        user_id=effective_user_id,
        question=payload.question,
        limit=payload.limit,
    )
    return AnalyticsQueryResponse.model_validate(result)


@app.get("/api/v1/chat-sessions", response_model=list[ChatSessionRead])
async def list_chat_sessions(
    kind: str = Query(default="workspace"),
    limit: int = Query(default=100, ge=1, le=500),
    user_id: str = Depends(resolve_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = ChatSessionRepository(session)
    sessions = await repo.list_by_user(user_id=user_id, kind=kind, limit=limit)
    return [ChatSessionRead.model_validate(s) for s in sessions]


@app.post("/api/v1/chat-sessions", response_model=ChatSessionRead)
async def create_chat_session(
    payload: ChatSessionCreateRequest,
    user_id: str = Depends(resolve_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = ChatSessionRepository(session)
    chat = await repo.create(
        ChatSession(
            user_id=user_id,
            kind=payload.kind,
            title=payload.title,
            goal_prompt=payload.goal_prompt,
            messages=payload.messages,
            metadata_json=payload.metadata_json,
        )
    )
    return ChatSessionRead.model_validate(chat)


@app.get("/api/v1/chat-sessions/{session_id}", response_model=ChatSessionRead)
async def get_chat_session(
    session_id: str,
    user_id: str = Depends(resolve_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = ChatSessionRepository(session)
    chat = await repo.get(session_id)
    if chat is None or chat.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return ChatSessionRead.model_validate(chat)


@app.patch("/api/v1/chat-sessions/{session_id}", response_model=ChatSessionRead)
async def update_chat_session(
    session_id: str,
    payload: ChatSessionUpdateRequest,
    user_id: str = Depends(resolve_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = ChatSessionRepository(session)
    chat = await repo.get(session_id)
    if chat is None or chat.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    if payload.title is not None:
        chat.title = payload.title
    if payload.goal_prompt is not None:
        chat.goal_prompt = payload.goal_prompt
    if payload.messages is not None:
        chat.messages = payload.messages
    if payload.metadata_json is not None:
        chat.metadata_json = payload.metadata_json

    chat = await repo.save(chat)
    return ChatSessionRead.model_validate(chat)


@app.delete("/api/v1/chat-sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    user_id: str = Depends(resolve_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = ChatSessionRepository(session)
    chat = await repo.get(session_id)
    if chat is None or chat.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    await repo.delete(chat)
    return {"status": "deleted", "id": session_id}


@app.get("/api/v1/agent-runs", response_model=list[AgentRunRead])
async def list_agent_runs(
    user_id: str = Depends(resolve_user_id),
    limit: int = Query(default=20, ge=1, le=100),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_agent_runs(user_id, limit=limit)


@app.get("/api/v1/agent-runs/stream", include_in_schema=True)
async def stream_agent_runs(
    user_id: str = Depends(resolve_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Server-Sent Events stream that emits new agent-run records as they are
    created.  Polls every 2 s; heartbeats every 15 s to keep the connection alive
    through proxies and load-balancers."""
    from telova_api.repositories.analytics import AgentRunRepository

    repo = AgentRunRepository(session)

    async def event_generator():
        last_seen_id: str | None = None
        heartbeat_counter = 0

        # Send initial snapshot (last 5 runs) so the client has something to show.
        initial = await repo.list_by_user(user_id, limit=5)
        if initial:
            last_seen_id = initial[0].id
            for run in reversed(initial):
                data = AgentRunRead.model_validate(run).model_dump(mode="json")
                yield f"event: agent_run\ndata: {json.dumps(data)}\n\n"

        while True:
            await asyncio.sleep(2)
            heartbeat_counter += 1

            # Heartbeat every 15 s (7–8 poll cycles at 2 s each).
            if heartbeat_counter % 8 == 0:
                yield ": heartbeat\n\n"

            recent = await repo.list_by_user(user_id, limit=20)
            new_runs = []
            for run in recent:
                if run.id == last_seen_id:
                    break
                new_runs.append(run)

            if new_runs:
                last_seen_id = new_runs[0].id
                for run in reversed(new_runs):
                    data = AgentRunRead.model_validate(run).model_dump(mode="json")
                    yield f"event: agent_run\ndata: {json.dumps(data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/v1/sync-logs", response_model=list[McpSyncLogRead])
async def list_sync_logs(
    user_id: str = Depends(resolve_user_id),
    limit: int = Query(default=50, ge=1, le=200),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_sync_logs(user_id, limit=limit)


@app.get("/api/v1/notes", response_model=list[NoteRead])
async def list_notes(
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_notes(user_id)


@app.post("/api/v1/notes", response_model=NoteRead)
async def create_note(
    payload: NoteCreateRequest,
    orchestrator=Depends(get_orchestrator),
    current_user=Depends(get_optional_current_user),
):
    effective_user_id = current_user.id if current_user is not None else payload.user_id
    return await orchestrator.create_note(
        user_id=effective_user_id,
        title=payload.title,
        content=payload.content,
        goal_id=payload.goal_id,
        note_type=payload.note_type,
    )


@app.patch("/api/v1/notes/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: str,
    payload: NoteUpdateRequest,
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    note = await orchestrator.update_note(
        note_id,
        title=payload.title,
        content=payload.content,
        user_id=user_id,
    )
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note


@app.get("/api/v1/calendar/events", response_model=list[CalendarEventRead])
async def list_calendar_events(
    user_id: str = Depends(resolve_user_id),
    orchestrator=Depends(get_orchestrator),
):
    return await orchestrator.list_calendar_events(user_id)


@app.post("/api/v1/calendar/events", response_model=CalendarEventRead)
async def create_calendar_event(
    payload: CalendarEventCreateRequest,
    orchestrator=Depends(get_orchestrator),
    current_user=Depends(get_optional_current_user),
):
    effective_user_id = current_user.id if current_user is not None else payload.user_id
    return await orchestrator.create_external_calendar_event(
        user_id=effective_user_id,
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
    user_id: str = Depends(resolve_user_id),
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
    data_analyst = orchestrator.describe_data_analyst()

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
    alloydb_ai_ready = bool(
        settings.alloydb_ai_nl_enabled
        and settings.alloydb_ai_nl_config_id
        and (alloydb_ready or postgres_ready)
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
            AgentHealthRead(
                name="Data Analyst",
                role="AlloyDB natural-language query layer",
                status=data_analyst["status"],
                detail=data_analyst["detail"],
                load_label="NL-to-SQL ready",
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
            ToolConnectionRead(
                name="AlloyDB AI NL",
                kind="NL-SQL",
                status="connected" if alloydb_ai_ready else "warning",
                detail=(
                    f"Using AlloyDB AI natural language config {settings.alloydb_ai_nl_config_id}."
                    if alloydb_ai_ready
                    else "Enable AlloyDB AI natural language and set ALLOYDB_AI_NL_CONFIG_ID."
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
                name="AlloyDB AI NL",
                status="ready" if alloydb_ai_ready else "pending",
                detail=(
                    f"AlloyDB AI natural language is configured with {settings.alloydb_ai_nl_config_id}."
                    if alloydb_ai_ready
                    else "Enable ALLOYDB_AI_NL_ENABLED and provision the AlloyDB AI NL config."
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


# ── MCP server SSE endpoints ────────────────────────────────────────────────
# Each FastMCP server is mounted as a sub-application so external MCP clients
# (Claude Desktop, other agents) can connect over Server-Sent Events.
import logging as _logging
_logger = _logging.getLogger(__name__)

try:
    from telova_api.mcp_servers.tasks_server import mcp as _tasks_mcp
    from telova_api.mcp_servers.calendar_server import mcp as _calendar_mcp
    from telova_api.mcp_servers.notes_server import mcp as _notes_mcp

    app.mount("/mcp/tasks", _tasks_mcp.sse_app())
    app.mount("/mcp/calendar", _calendar_mcp.sse_app())
    app.mount("/mcp/notes", _notes_mcp.sse_app())
except Exception as _mcp_err:
    _logger.warning("MCP server mounts skipped: %s", _mcp_err)


if FRONTEND_DIST_DIR.exists():
    app.mount(
        "/",
        StaticFiles(directory=FRONTEND_DIST_DIR, html=True),
        name="frontend",
    )
else:

    @app.get("/", include_in_schema=False)
    async def frontend_not_built():
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    "Frontend build not found. Run `npm run build` to export the "
                    "Next.js app into ./out before serving it from FastAPI."
                )
            },
        )

