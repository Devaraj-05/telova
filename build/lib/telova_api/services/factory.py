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
from telova_api.repositories.calendar import CalendarEventRepository
from telova_api.repositories.goals import GoalRepository
from telova_api.repositories.notes import (
    ContextPackageRepository,
    NoteRepository,
    ReplanRepository,
)
from telova_api.repositories.tasks import TaskRepository
from telova_api.secrets import SecretResolver
from telova_api.services.orchestrator import TelovaOrchestratorService
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

    scheduler = TimeboxScheduler(settings.app_timezone)
    secret_resolver = SecretResolver(settings)
    workspace_factory = GoogleWorkspaceClientFactory(settings, secret_resolver)
    goal_decomposer = GoalDecomposerAgent(scheduler)
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
        )
        calendar_gateway = GoogleCalendarGateway(
            calendar_repo,
            workspace_factory=workspace_factory,
            settings=settings,
        )
        notes_gateway = GoogleNotesGateway(
            note_repo,
            context_repo,
            replan_repo,
            workspace_factory=workspace_factory,
            settings=settings,
        )
    else:
        task_gateway = DatabaseTaskGateway(task_repo)
        calendar_gateway = DatabaseCalendarGateway(calendar_repo)
        notes_gateway = DatabaseNotesGateway(note_repo, context_repo, replan_repo)

    return TelovaOrchestratorService(
        goal_repo=goal_repo,
        task_repo=task_repo,
        calendar_repo=calendar_repo,
        note_repo=note_repo,
        task_gateway=task_gateway,
        calendar_gateway=calendar_gateway,
        notes_gateway=notes_gateway,
        planning_runtime=planning_runtime,
        conflict_sentinel=ConflictSentinelAgent(scheduler),
        context_bridge=ContextBridgeAgent(),
        progress_adaptor=ProgressAdaptorAgent(
            scheduler=scheduler,
            deviation_threshold=settings.progress_deviation_threshold,
        ),
        auto_resolve_conflicts=settings.auto_resolve_conflicts,
    )

