from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from telova_api.models import CalendarEvent, Task
from telova_api.services.scheduling import BusyWindow, TimeboxScheduler


@dataclass(frozen=True)
class ConflictAlert:
    goal_id: str
    task_id: str
    task_title: str
    task_event_id: str
    colliding_event_id: str
    colliding_title: str
    original_start: datetime
    original_end: datetime
    suggested_start: datetime | None
    suggested_end: datetime | None
    auto_resolved: bool
    reason: str


class ConflictSentinelAgent:
    def __init__(self, scheduler: TimeboxScheduler) -> None:
        self.scheduler = scheduler

    def inspect(
        self,
        goal_id: str,
        tasks: list[Task],
        system_events: list[CalendarEvent],
        external_events: list[CalendarEvent],
    ) -> list[ConflictAlert]:
        tasks_by_id = {task.id: task for task in tasks}
        alerts: list[ConflictAlert] = []

        for system_event in system_events:
            task = tasks_by_id.get(system_event.task_id or "")
            if task is None:
                continue
            system_start = self.scheduler.ensure_utc(system_event.start_at)
            system_end = self.scheduler.ensure_utc(system_event.end_at)

            duration_minutes = max(
                int((system_end - system_start).total_seconds() // 60),
                30,
            )
            for external_event in external_events:
                external_start = self.scheduler.ensure_utc(external_event.start_at)
                external_end = self.scheduler.ensure_utc(external_event.end_at)
                overlaps = (
                    system_start < external_end
                    and system_end > external_start
                )
                if not overlaps:
                    continue

                busy_windows = [
                    BusyWindow(
                        start_at=self.scheduler.ensure_utc(event.start_at),
                        end_at=self.scheduler.ensure_utc(event.end_at),
                    )
                    for event in [*system_events, *external_events]
                    if event.id != system_event.id
                ]
                suggestion = self.scheduler.find_next_slot(
                    duration_minutes=duration_minutes,
                    busy_windows=busy_windows,
                    after=external_end,
                    horizon_days=14,
                )
                suggested_start, suggested_end = (
                    suggestion if suggestion is not None else (None, None)
                )
                alerts.append(
                    ConflictAlert(
                        goal_id=goal_id,
                        task_id=task.id,
                        task_title=task.title,
                        task_event_id=system_event.id,
                        colliding_event_id=external_event.id,
                        colliding_title=external_event.title,
                        original_start=system_start,
                        original_end=system_end,
                        suggested_start=suggested_start,
                        suggested_end=suggested_end,
                        auto_resolved=False,
                        reason="Task block overlaps an external commitment in the next scan window.",
                    )
                )
                break

        return alerts

