from datetime import timedelta

from telova_api.agents.progress_adaptor import ProgressAdaptorAgent
from telova_api.models import CalendarEvent, EventSource, Goal, Task
from telova_api.services.scheduling import TimeboxScheduler


def test_progress_adaptor_replans_when_goal_is_slipping():
    scheduler = TimeboxScheduler("Asia/Kolkata")
    agent = ProgressAdaptorAgent(scheduler=scheduler, deviation_threshold=0.2)
    now = scheduler.now()

    goal = Goal(id="goal-1", user_id="demo-user", title="Ship MVP", domain="product_launch")
    first_task = Task(
        id="task-1",
        goal_id="goal-1",
        user_id="demo-user",
        title="Define launch scope",
        description="",
        depends_on=[],
        estimated_minutes=60,
        scheduled_start=now - timedelta(days=3, hours=1),
        scheduled_end=now - timedelta(days=3),
        order_index=0,
        status="pending",
    )
    second_task = Task(
        id="task-2",
        goal_id="goal-1",
        user_id="demo-user",
        title="Build MVP",
        description="",
        depends_on=["task-1"],
        estimated_minutes=120,
        scheduled_start=now + timedelta(days=1),
        scheduled_end=now + timedelta(days=1, hours=2),
        order_index=1,
        status="pending",
    )
    external_event = CalendarEvent(
        id="ext-1",
        user_id="demo-user",
        title="Customer interview",
        description="",
        source=EventSource.EXTERNAL.value,
        start_at=now + timedelta(hours=4),
        end_at=now + timedelta(hours=5),
        metadata_json={},
    )

    result = agent.review(
        goal=goal,
        tasks=[first_task, second_task],
        events=[external_event],
    )

    assert result.replanned is True
    assert result.deviation_pct > 0.2
    assert "re-sequenced" in result.summary
    assert result.task_updates

