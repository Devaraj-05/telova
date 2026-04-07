from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.agents.conflict_sentinel import ConflictSentinelAgent
from telova_api.agents.context_bridge import ContextBridgeAgent
from telova_api.agents.goal_decomposer import GoalDecomposerAgent
from telova_api.agents.progress_adaptor import ProgressAdaptorAgent
from telova_api.config import get_settings
from telova_api.integrations.calendar import (
    DatabaseCalendarGateway,
    GoogleCalendarGateway,
)
from telova_api.integrations.google_workspace import GoogleWorkspaceClientFactory
from telova_api.integrations.notes import DatabaseNotesGateway, GoogleNotesGateway
from telova_api.integrations.tasks import DatabaseTaskGateway, GoogleTaskGateway
from telova_api.repositories.analytics import AgentRunRepository, McpSyncLogRepository
from telova_api.repositories.calendar import CalendarEventRepository
from telova_api.repositories.goals import GoalRepository
from telova_api.repositories.google_connections import (
    GoogleWorkspaceConnectionRepository,
)
from telova_api.repositories.notes import (
    ContextPackageRepository,
    NoteRepository,
    ReplanRepository,
)
from telova_api.repositories.tasks import TaskRepository
from telova_api.secrets import SecretResolver
from telova_api.services.orchestrator import TelovaOrchestratorService
from telova_api.services.data_analyst import ProductivityDataAnalystService
from telova_api.services.planning_runtime import (
    DeterministicPlanningRuntime,
    GoogleAdkPlanningRuntime,
)
from telova_api.services.scheduling import TimeboxScheduler


def build_orchestrator(session: AsyncSession) -> TelovaOrchestratorService:
    settings = get_settings()
    goal_repo = GoalRepository(session)
    task_repo = TaskRepository(session)
    calendar_repo = CalendarEventRepository(session)
    note_repo = NoteRepository(session)
    context_repo = ContextPackageRepository(session)
    replan_repo = ReplanRepository(session)
    agent_run_repo = AgentRunRepository(session)
    sync_log_repo = McpSyncLogRepository(session)
    connection_repo = GoogleWorkspaceConnectionRepository(session)

    scheduler = TimeboxScheduler(settings.app_timezone)
    secret_resolver = SecretResolver(settings)
    workspace_factory = GoogleWorkspaceClientFactory(
        settings,
        secret_resolver,
        connection_repo=connection_repo,
    )
    goal_decomposer = GoalDecomposerAgent(scheduler)
    data_analyst = ProductivityDataAnalystService(
        session=session,
        settings=settings,
    )
    planning_runtime = DeterministicPlanningRuntime(goal_decomposer)

    if settings.is_google_adk_runtime:
        planning_runtime = GoogleAdkPlanningRuntime(
            settings=settings,
            goal_decomposer=goal_decomposer,
            fallback_runtime=planning_runtime,
        )

    if settings.is_google_backend:
        task_gateway = GoogleTaskGateway(
            task_repo,
            workspace_factory=workspace_factory,
            settings=settings,
            sync_log_repo=sync_log_repo,
        )
        calendar_gateway = GoogleCalendarGateway(
            calendar_repo,
            workspace_factory=workspace_factory,
            settings=settings,
            sync_log_repo=sync_log_repo,
        )
        notes_gateway = GoogleNotesGateway(
            note_repo,
            context_repo,
            replan_repo,
            workspace_factory=workspace_factory,
            settings=settings,
            sync_log_repo=sync_log_repo,
        )
    else:
        task_gateway = DatabaseTaskGateway(task_repo, sync_log_repo=sync_log_repo)
        calendar_gateway = DatabaseCalendarGateway(
            calendar_repo,
            sync_log_repo=sync_log_repo,
        )
        notes_gateway = DatabaseNotesGateway(
            note_repo,
            context_repo,
            replan_repo,
            sync_log_repo=sync_log_repo,
        )

    return TelovaOrchestratorService(
        settings=settings,
        goal_repo=goal_repo,
        task_repo=task_repo,
        calendar_repo=calendar_repo,
        note_repo=note_repo,
        agent_run_repo=agent_run_repo,
        sync_log_repo=sync_log_repo,
        task_gateway=task_gateway,
        calendar_gateway=calendar_gateway,
        notes_gateway=notes_gateway,
        data_analyst=data_analyst,
        planning_runtime=planning_runtime,
        conflict_sentinel=ConflictSentinelAgent(scheduler),
        context_bridge=ContextBridgeAgent(),
        progress_adaptor=ProgressAdaptorAgent(
            scheduler=scheduler,
            deviation_threshold=settings.progress_deviation_threshold,
        ),
        auto_resolve_conflicts=settings.auto_resolve_conflicts,
    )

