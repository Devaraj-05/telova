from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GoalCreateRequest(BaseModel):
    user_id: str = Field(..., examples=["demo-user"])
    goal: str = Field(..., examples=["Get promoted to Senior Engineer in 6 months"])
    description: str | None = None
    deadline: datetime | None = None
    priority: str | None = None
    constraints: list[str] = Field(default_factory=list)


class GoalPreviewTaskRead(BaseModel):
    key: str
    title: str
    description: str
    phase: str
    estimated_minutes: int
    depends_on: list[str]
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    milestone: bool = False
    order_index: int


class GoalSwitchRequest(BaseModel):
    user_id: str
    target_goal_id: str


class TaskUpdateRequest(BaseModel):
    status: str


class NoteCreateRequest(BaseModel):
    user_id: str
    title: str
    content: str
    goal_id: str | None = None
    note_type: str = "manual"


class NoteUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None


class CalendarEventCreateRequest(BaseModel):
    user_id: str
    title: str
    description: str = ""
    start_at: datetime
    end_at: datetime
    goal_id: str | None = None
    task_id: str | None = None
    source: str = "external"


class CronRequest(BaseModel):
    user_id: str | None = None
    auto_resolve: bool | None = None


class AnalyticsQueryRequest(BaseModel):
    user_id: str = Field(..., examples=["demo-user"])
    question: str = Field(
        ...,
        examples=["Which goal has the highest deviation from plan?"],
    )
    limit: int = Field(default=10, ge=1, le=50)


class SignupRequest(BaseModel):
    email: str = Field(..., examples=["devaraj@example.com"])
    password: str = Field(..., min_length=8, examples=["Telova@123"])
    display_name: str | None = Field(default=None, examples=["Devaraj"])


class LoginRequest(BaseModel):
    email: str = Field(..., examples=["devaraj@example.com"])
    password: str = Field(..., min_length=8, examples=["Telova@123"])


class GoogleAuthorizationUrlRead(BaseModel):
    authorization_url: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    google_subject: str | None = None
    created_at: datetime
    updated_at: datetime


class AuthResponse(BaseModel):
    user: UserRead
    access_token: str
    token_type: str = "bearer"


class GoogleConnectionStatusRead(BaseModel):
    status: str
    provider_email: str | None = None
    calendar_connected: bool
    tasks_connected: bool
    keep_connected: bool
    scopes: list[str]
    connected_at: datetime | None = None
    detail: str


class GoalDagNode(BaseModel):
    key: str
    title: str
    phase: str
    estimated_minutes: int
    depends_on: list[str]
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    milestone: bool = False


class GoalDagEdge(BaseModel):
    from_node: str
    to_node: str


class GoalDagResponse(BaseModel):
    domain: str
    nodes: list[GoalDagNode]
    edges: list[GoalDagEdge]
    milestones: list[str]


class GoalPlanPreviewResponse(BaseModel):
    domain: str
    deadline: datetime
    summary: str
    dag: GoalDagResponse
    tasks: list[GoalPreviewTaskRead]


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    description: str | None = None
    domain: str
    status: str
    deadline: datetime | None = None
    deviation: float
    created_at: datetime
    updated_at: datetime


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    goal_id: str
    user_id: str
    title: str
    description: str
    phase: str
    status: str
    depends_on: list[str]
    estimated_minutes: int
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    completed_at: datetime | None = None
    calendar_event_id: str | None = None
    order_index: int


class CalendarEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    goal_id: str | None = None
    task_id: str | None = None
    title: str
    description: str
    source: str
    start_at: datetime
    end_at: datetime
    metadata_json: dict[str, Any]


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    goal_id: str | None = None
    title: str
    content: str
    note_type: str
    metadata_json: dict[str, Any]
    created_at: datetime


class ContextPackageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    from_goal_id: str | None = None
    to_goal_id: str | None = None
    note_id: str | None = None
    summary: str
    open_items: list[dict[str, Any]]
    created_at: datetime


class ReplanEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    goal_id: str
    deviation_pct: float
    old_dag: dict[str, Any]
    new_dag: dict[str, Any]
    summary: str
    triggered_at: datetime


class GoalPlanResponse(BaseModel):
    goal: GoalRead
    dag: GoalDagResponse
    tasks: list[TaskRead]
    calendar_events: list[CalendarEventRead]


class ConflictAlertRead(BaseModel):
    goal_id: str
    task_id: str
    task_title: str
    task_event_id: str
    colliding_event_id: str
    colliding_title: str
    original_start: datetime
    original_end: datetime
    suggested_start: datetime | None = None
    suggested_end: datetime | None = None
    auto_resolved: bool = False
    reason: str


class WeeklyReviewResponse(BaseModel):
    goal_id: str
    deviation_pct: float
    replanned: bool
    summary: str
    updated_task_ids: list[str]


class DashboardRead(BaseModel):
    goals: list[GoalRead]
    recent_tasks: list[TaskRead]
    upcoming_events: list[CalendarEventRead]
    notes: list[NoteRead]


class SystemMetricRead(BaseModel):
    label: str
    value: int
    tone: str = "info"


class AgentHealthRead(BaseModel):
    name: str
    role: str
    status: str
    detail: str
    load_label: str


class ToolConnectionRead(BaseModel):
    name: str
    kind: str
    status: str
    detail: str


class WorkflowLogRead(BaseModel):
    title: str
    detail: str
    status: str
    timestamp: datetime | None = None


class ReadinessCheckRead(BaseModel):
    name: str
    status: str
    detail: str


class AgentRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    goal_id: str | None = None
    agent_name: str
    operation: str
    status: str
    runtime: str
    input_payload: dict[str, Any]
    output_payload: dict[str, Any]
    sql_text: str | None = None
    started_at: datetime
    completed_at: datetime


class McpSyncLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    tool_name: str
    operation: str
    status: str
    resource_type: str
    goal_id: str | None = None
    task_id: str | None = None
    note_id: str | None = None
    event_id: str | None = None
    local_id: str | None = None
    external_id: str | None = None
    detail: str
    payload_json: dict[str, Any]
    created_at: datetime


class AnalyticsQueryResponse(BaseModel):
    question: str
    summary: str
    generated_sql: str
    rows: list[dict[str, Any]]
    row_count: int
    execution_mode: str
    source_objects: list[str]
    fallback_reason: str | None = None


class SystemStatusRead(BaseModel):
    app: str
    environment: str
    database: str
    runtime_mode: str
    orchestration_runtime: str
    integration_backend: str
    auth_mode: str
    rate_limit: str
    status: str
    last_updated: datetime
    metrics: list[SystemMetricRead]
    agents: list[AgentHealthRead]
    connections: list[ToolConnectionRead]
    workflows: list[WorkflowLogRead]
    readiness: list[ReadinessCheckRead]
