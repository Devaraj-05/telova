from datetime import timedelta

from telova_api.agents.conflict_sentinel import ConflictSentinelAgent
from telova_api.models import CalendarEvent, EventSource, Task
from telova_api.services.scheduling import TimeboxScheduler


def test_conflict_sentinel_detects_overlap_and_suggests_slot():
    scheduler = TimeboxScheduler("Asia/Kolkata")
    agent = ConflictSentinelAgent(scheduler)
    now = scheduler.now()

    task = Task(
        id="task-1",
        goal_id="goal-1",
        user_id="demo-user",
        title="Deep work session",
        description="",
        depends_on=[],
        scheduled_start=now + timedelta(hours=3),
        scheduled_end=now + timedelta(hours=4),
    )
    system_event = CalendarEvent(
        id="event-1",
        user_id="demo-user",
        goal_id="goal-1",
        task_id="task-1",
        title="Deep work session",
        description="",
        source=EventSource.SYSTEM.value,
        start_at=now + timedelta(hours=3),
        end_at=now + timedelta(hours=4),
        metadata_json={},
    )
    external_event = CalendarEvent(
        id="event-2",
        user_id="demo-user",
        title="Team standup",
        description="",
        source=EventSource.EXTERNAL.value,
        start_at=now + timedelta(hours=3, minutes=30),
        end_at=now + timedelta(hours=4, minutes=15),
        metadata_json={},
    )

    alerts = agent.inspect(
        goal_id="goal-1",
        tasks=[task],
        system_events=[system_event],
        external_events=[external_event],
    )

    assert len(alerts) == 1
    assert alerts[0].colliding_title == "Team standup"
    assert alerts[0].suggested_start is not None
    assert alerts[0].suggested_start >= external_event.end_at


