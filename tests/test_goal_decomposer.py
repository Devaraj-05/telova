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


def test_goal_decomposer_uses_detailed_plan_text_for_day_titles():
    scheduler = TimeboxScheduler("Asia/Kolkata")
    agent = GoalDecomposerAgent(scheduler)

    result = agent.build_plan(
        goal_text="I want to Get a Job for AI Engineer Role",
        description="Need a structured 2 month plan.",
        deadline=None,
        busy_windows=[],
        detailed_plan_text=(
            "Timeline: 2 months\n"
            "Daily Commitment: 2 hours per day\n"
            "Phase 1: AI/ML Foundations — Week 1-2\n"
            'Day 1 (Mon): Python Data Structures & Algorithms Refresher — 2h. '
            'Review Python lists and solve "Two Sum."\n'
            "Day 2 (Tue): Object-Oriented Programming in Python — 2h. "
            "Build a small class hierarchy."
        ),
    )

    assert result.tasks
    assert result.tasks[0]["title"] == "Day 1: Python Data Structures & Algorithms Refresher — 2h"
    assert result.tasks[0]["description"] == 'Review Python lists and solve "Two Sum."'
    assert result.tasks[1]["depends_on"] == [result.tasks[0]["key"]]


