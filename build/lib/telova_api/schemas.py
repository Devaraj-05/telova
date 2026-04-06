from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GoalCreateRequest(BaseModel):
    user_id: str = Field(..., examples=["demo-user"])
    goal: str = Field(..., examples=["Get promoted to Senior Engineer in 6 months"])
    description: str | None = None
    deadline: datetime | None = None


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
