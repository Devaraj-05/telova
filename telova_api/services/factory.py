from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.agents.conflict_sentinel import ConflictSentinelAgent
from telova_api.agents.context_bridge import ContextBridgeAgent
from telova_api.agents.goal_decomposer import GoalDecomposerAgent
from telova_api.agents.progress_adaptor import ProgressAdaptorAgent
from telova_api.config import get_settings
from telova_api.integrations.calendar import DatabaseCalendarGateway
from telova_api.integrations.notes import DatabaseNotesGateway
from telova_api.integrations.tasks import DatabaseTaskGateway
from telova_api.repositories.calendar import CalendarEventRepository
from telova_api.repositories.goals import GoalRepository
from telova_api.repositories.notes import (
    ContextPackageRepository,
    NoteRepository,
    ReplanRepository,
)
from telova_api.repositories.tasks import TaskRepository
from telova_api.services.orchestrator import TelovaOrchestratorService
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
        goal_decomposer=GoalDecomposerAgent(scheduler),
        conflict_sentinel=ConflictSentinelAgent(scheduler),
        context_bridge=ContextBridgeAgent(),
        progress_adaptor=ProgressAdaptorAgent(
            scheduler=scheduler,
            deviation_threshold=settings.progress_deviation_threshold,
        ),
        auto_resolve_conflicts=settings.auto_resolve_conflicts,
    )

