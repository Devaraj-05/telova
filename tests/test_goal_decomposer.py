from telova_api.agents.goal_decomposer import GoalDecomposerAgent
from telova_api.services.scheduling import TimeboxScheduler


def test_goal_decomposer_builds_career_graph():
    scheduler = TimeboxScheduler("Asia/Kolkata")
    agent = GoalDecomposerAgent(scheduler)

    result = agent.build_plan(
        goal_text="Get promoted to Senior Engineer in 6 months",
        description="Backend engineer looking to grow into broader ownership.",
        deadline=None,
        busy_windows=[],
    )

    assert result.domain == "career_growth"
    assert len(result.tasks) >= 6
    assert result.tasks[0]["key"] == "promotion_rubric"
    assert any(task["depends_on"] for task in result.tasks[1:])
    assert result.dag["milestones"]


def test_goal_decomposer_inferrs_reasonable_deadline():
    scheduler = TimeboxScheduler("Asia/Kolkata")
    agent = GoalDecomposerAgent(scheduler)

    deadline = agent.infer_deadline("Launch an MVP in 4 weeks")

    assert deadline > scheduler.now()


