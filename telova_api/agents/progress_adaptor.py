from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from telova_api.models import CalendarEvent, Goal, Task
from telova_api.services.scheduling import BusyWindow, TimeboxScheduler


@dataclass(frozen=True)
class ProgressReviewResult:
    goal_id: str
    deviation_pct: float
    replanned: bool
    summary: str
    task_updates: dict[str, tuple]
    status_report: str


class ProgressAdaptorAgent:
    def __init__(self, scheduler: TimeboxScheduler, deviation_threshold: float) -> None:
        self.scheduler = scheduler
        self.deviation_threshold = deviation_threshold

    def review(
        self,
        goal: Goal,
        tasks: list[Task],
        events: list[CalendarEvent],
    ) -> ProgressReviewResult:
        now = self.scheduler.now()
        due_tasks = [
            task
            for task in tasks
            if task.scheduled_end
            and self.scheduler.ensure_utc(task.scheduled_end) <= now
        ]
        overdue_tasks = [task for task in due_tasks if task.status != "done"]
        deviation = (
            len(overdue_tasks) / len(due_tasks)
            if due_tasks
            else 0.0
        )

        summary = (
            f"Goal '{goal.title}' has {len(overdue_tasks)} overdue tasks out of "
            f"{len(due_tasks)} due tasks."
        )
        replanned = deviation > self.deviation_threshold and any(
            task.status != "done" for task in tasks
        )
        updates: dict[str, tuple] = {}

        if replanned:
            pending_tasks = sorted(
                [task for task in tasks if task.status != "done"],
                key=lambda task: task.order_index,
            )
            dependencies_end: dict[str, object] = {
                task.id: task.scheduled_end or now
                for task in tasks
                if task.status == "done"
            }
            busy_windows = [
                BusyWindow(
                    start_at=self.scheduler.ensure_utc(event.start_at),
                    end_at=self.scheduler.ensure_utc(event.end_at),
                )
                for event in events
                if event.source == "external"
            ]

            cursor = now + timedelta(hours=2)
            for task in pending_tasks:
                dependency_end = max(
                    (
                        dependencies_end.get(dependency_id, cursor)
                        for dependency_id in task.depends_on
                    ),
                    default=cursor,
                )
                after = max(cursor, dependency_end)
                slot = self.scheduler.find_next_slot(
                    duration_minutes=task.estimated_minutes,
                    busy_windows=busy_windows,
                    after=after,
                    horizon_days=60,
                )
                if slot is None:
                    continue
                updates[task.id] = slot
                start_at, end_at = slot
                busy_windows.append(BusyWindow(start_at=start_at, end_at=end_at))
                dependencies_end[task.id] = end_at
                cursor = end_at + timedelta(minutes=30)

            summary += " Deviation crossed the threshold, so pending work was re-sequenced."

        status_report_lines = [
            f"Weekly review for '{goal.title}'",
            f"- Due tasks: {len(due_tasks)}",
            f"- Overdue tasks: {len(overdue_tasks)}",
            f"- Deviation: {deviation:.0%}",
        ]
        if replanned:
            status_report_lines.append(
                f"- Re-planned pending tasks: {len(updates)}"
            )
        else:
            status_report_lines.append("- Plan remains stable this week.")

        return ProgressReviewResult(
            goal_id=goal.id,
            deviation_pct=deviation,
            replanned=replanned,
            summary=summary,
            task_updates=updates,
            status_report="\n".join(status_report_lines),
        )

