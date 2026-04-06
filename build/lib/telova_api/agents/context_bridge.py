from __future__ import annotations

from dataclasses import dataclass

from telova_api.models import Goal, Task


@dataclass(frozen=True)
class ContextBridgeResult:
    summary: str
    open_items: list[dict]
    title: str


class ContextBridgeAgent:
    def build_context_package(
        self,
        from_goal: Goal,
        to_goal: Goal,
        from_tasks: list[Task],
        to_tasks: list[Task],
    ) -> ContextBridgeResult:
        open_from_tasks = [task for task in from_tasks if task.status != "done"]
        next_for_target = [task for task in to_tasks if task.status != "done"][:3]
        completed_recently = [task.title for task in from_tasks if task.status == "done"][:3]

        open_items = [
            {
                "task_id": task.id,
                "title": task.title,
                "scheduled_start": task.scheduled_start.isoformat()
                if task.scheduled_start
                else None,
                "scheduled_end": task.scheduled_end.isoformat()
                if task.scheduled_end
                else None,
            }
            for task in open_from_tasks[:5]
        ]

        lines = [
            f"Switching context from '{from_goal.title}' to '{to_goal.title}'.",
            "",
            "Where you left off:",
        ]
        if open_from_tasks:
            lines.extend(f"- {task.title}" for task in open_from_tasks[:5])
        else:
            lines.append("- No open tasks remain on the current goal.")

        lines.append("")
        lines.append("Recent wins:")
        if completed_recently:
            lines.extend(f"- {title}" for title in completed_recently)
        else:
            lines.append("- No completed tasks have been captured yet.")

        lines.append("")
        lines.append("Best next moves on the target goal:")
        if next_for_target:
            lines.extend(f"- {task.title}" for task in next_for_target)
        else:
            lines.append("- The target goal needs planning or has already been completed.")

        return ContextBridgeResult(
            title=f"Context package: {from_goal.title} -> {to_goal.title}",
            summary="\n".join(lines),
            open_items=open_items,
        )


