from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import re

from telova_api.services.scheduling import BusyWindow, TimeboxScheduler


@dataclass(frozen=True)
class BlueprintTask:
    key: str
    title: str
    description: str
    phase: str
    estimated_minutes: int
    depends_on: tuple[str, ...] = ()
    milestone: bool = False


@dataclass(frozen=True)
class GoalDecompositionResult:
    domain: str
    deadline: datetime
    tasks: list[dict]
    dag: dict


DAY_LINE_RE = re.compile(
    r"^\s*(?:[-*]\s*)?(?:\*\*)?Day\s+(?P<number>\d+)\s*\((?P<label>[^)]*)\)\s*:\s*(?:\*\*)?\s*(?P<body>.+?)\s*(?:\*\*)?\s*$",
    re.IGNORECASE,
)
PHASE_LINE_RE = re.compile(
    r"^\s*(?:[-*]\s*)?(?:\*\*)?Phase\s+(?P<number>\d+)\s*:\s*(?P<title>.+?)(?:\s+[—–-]\s+Week.*)?\s*(?:\*\*)?\s*$",
    re.IGNORECASE,
)
DURATION_RE = re.compile(
    r"^(?P<title>.+?)\s*[—–-]\s*(?P<hours>\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\.?\s*(?P<description>.*)$",
    re.IGNORECASE,
)
DEFAULT_HOURS_RE = re.compile(
    r"(?:Daily Commitment|Hours per day)\s*:\s*(?P<hours>\d+(?:\.\d+)?)\s*(?:hours?|hrs?)",
    re.IGNORECASE,
)


DOMAIN_KEYWORDS = {
    "career_growth": ("promoted", "promotion", "senior engineer", "staff", "career"),
    "product_launch": ("launch", "ship", "deploy", "release", "mvp", "startup"),
    "skill_acceleration": ("learn", "study", "prepare", "practice", "interview", "cert"),
}

BLUEPRINTS: dict[str, list[BlueprintTask]] = {
    "career_growth": [
        BlueprintTask(
            key="promotion_rubric",
            title="Clarify the promotion rubric",
            description="Translate the goal into concrete promotion criteria, expectations, and proof points.",
            phase="planning",
            estimated_minutes=90,
            milestone=True,
        ),
        BlueprintTask(
            key="stakeholder_map",
            title="Map manager and sponsor expectations",
            description="Identify decision-makers, their expectations, and the evidence needed to influence them.",
            phase="planning",
            estimated_minutes=60,
            depends_on=("promotion_rubric",),
        ),
        BlueprintTask(
            key="visibility_plan",
            title="Create a visibility and communication plan",
            description="Set a repeatable rhythm for updates, demos, and visible impact tied to the target role.",
            phase="execution",
            estimated_minutes=90,
            depends_on=("stakeholder_map",),
        ),
        BlueprintTask(
            key="lead_initiative",
            title="Lead one high-impact initiative",
            description="Choose and drive a scoped initiative that demonstrates ownership, quality, and execution.",
            phase="execution",
            estimated_minutes=180,
            depends_on=("stakeholder_map",),
            milestone=True,
        ),
        BlueprintTask(
            key="mentorship",
            title="Mentor or unblock another teammate",
            description="Create visible evidence of leadership through mentorship, guidance, or team uplift.",
            phase="execution",
            estimated_minutes=90,
            depends_on=("visibility_plan",),
        ),
        BlueprintTask(
            key="evidence_log",
            title="Capture wins and feedback weekly",
            description="Maintain a lightweight achievement log with outcomes, feedback, and measurable impact.",
            phase="tracking",
            estimated_minutes=60,
            depends_on=("lead_initiative", "mentorship"),
        ),
        BlueprintTask(
            key="promotion_packet",
            title="Prepare the promotion packet and narrative",
            description="Package evidence into a concise case tied directly to the rubric and business impact.",
            phase="delivery",
            estimated_minutes=120,
            depends_on=("evidence_log",),
            milestone=True,
        ),
    ],
    "product_launch": [
        BlueprintTask(
            key="success_metric",
            title="Define the success metric and launch scope",
            description="State the problem, target user, success metric, and non-goals for the launch.",
            phase="planning",
            estimated_minutes=90,
            milestone=True,
        ),
        BlueprintTask(
            key="user_research",
            title="Validate the problem with user research",
            description="Collect evidence that the problem matters and sharpen the product direction.",
            phase="discovery",
            estimated_minutes=120,
            depends_on=("success_metric",),
        ),
        BlueprintTask(
            key="architecture",
            title="Draft the technical architecture",
            description="Design the system boundaries, tradeoffs, APIs, and deployment plan.",
            phase="design",
            estimated_minutes=120,
            depends_on=("user_research",),
            milestone=True,
        ),
        BlueprintTask(
            key="mvp_build",
            title="Build the MVP",
            description="Implement the core user flow and keep the build focused on proving value quickly.",
            phase="execution",
            estimated_minutes=240,
            depends_on=("architecture",),
        ),
        BlueprintTask(
            key="feedback_loop",
            title="Run a feedback loop with early users",
            description="Capture friction, missing expectations, and readiness blockers from real users.",
            phase="validation",
            estimated_minutes=90,
            depends_on=("mvp_build",),
        ),
        BlueprintTask(
            key="hardening",
            title="Harden the product for launch",
            description="Address key bugs, edge cases, observability gaps, and launch-readiness issues.",
            phase="hardening",
            estimated_minutes=180,
            depends_on=("feedback_loop",),
        ),
        BlueprintTask(
            key="launch",
            title="Launch and capture outcomes",
            description="Ship the product, monitor the rollout, and record lessons learned for iteration.",
            phase="delivery",
            estimated_minutes=120,
            depends_on=("hardening",),
            milestone=True,
        ),
    ],
    "skill_acceleration": [
        BlueprintTask(
            key="target_outcome",
            title="Define the target competency",
            description="Make the goal measurable by naming the target skill, level, and proof of success.",
            phase="planning",
            estimated_minutes=60,
            milestone=True,
        ),
        BlueprintTask(
            key="baseline",
            title="Assess the current baseline",
            description="Identify the strongest gaps so practice time is spent on the highest leverage work.",
            phase="planning",
            estimated_minutes=60,
            depends_on=("target_outcome",),
        ),
        BlueprintTask(
            key="learning_plan",
            title="Create the learning plan",
            description="Break the competency into modules, study loops, and measurable checkpoints.",
            phase="design",
            estimated_minutes=90,
            depends_on=("baseline",),
        ),
        BlueprintTask(
            key="deliberate_practice",
            title="Run deliberate practice blocks",
            description="Execute focused practice with repetition, feedback, and short review loops.",
            phase="execution",
            estimated_minutes=180,
            depends_on=("learning_plan",),
        ),
        BlueprintTask(
            key="project_application",
            title="Apply the skill in a project or simulation",
            description="Move beyond theory by using the skill in a realistic artifact or scenario.",
            phase="execution",
            estimated_minutes=180,
            depends_on=("deliberate_practice",),
            milestone=True,
        ),
        BlueprintTask(
            key="review",
            title="Review outcomes and close gaps",
            description="Evaluate what improved, what still blocks progress, and what needs another pass.",
            phase="delivery",
            estimated_minutes=90,
            depends_on=("project_application",),
        ),
    ],
    "generic_execution": [
        BlueprintTask(
            key="define_outcome",
            title="Define the target outcome",
            description="Turn the goal into a specific, measurable outcome with a deadline and a success metric.",
            phase="planning",
            estimated_minutes=60,
            milestone=True,
        ),
        BlueprintTask(
            key="milestones",
            title="Break the goal into milestones",
            description="Identify the critical steps, risks, and dependencies that shape the plan.",
            phase="planning",
            estimated_minutes=90,
            depends_on=("define_outcome",),
        ),
        BlueprintTask(
            key="execution_block",
            title="Execute the core work",
            description="Move the highest leverage work first while keeping the critical path visible.",
            phase="execution",
            estimated_minutes=180,
            depends_on=("milestones",),
            milestone=True,
        ),
        BlueprintTask(
            key="risk_review",
            title="Review risks and unblockers",
            description="Check whether new blockers or timeline drift require a plan adjustment.",
            phase="tracking",
            estimated_minutes=60,
            depends_on=("execution_block",),
        ),
        BlueprintTask(
            key="final_delivery",
            title="Deliver the outcome and capture lessons",
            description="Close the loop with a final output, evidence of completion, and a short retrospective.",
            phase="delivery",
            estimated_minutes=90,
            depends_on=("risk_review",),
            milestone=True,
        ),
    ],
}


class GoalDecomposerAgent:
    def __init__(self, scheduler: TimeboxScheduler) -> None:
        self.scheduler = scheduler

    def infer_deadline(self, goal_text: str, fallback_days: int = 90) -> datetime:
        text = goal_text.lower()
        match = re.search(r"(\d+)\s+(day|days|week|weeks|month|months)", text)
        if not match:
            return self.scheduler.now() + timedelta(days=fallback_days)

        amount = int(match.group(1))
        unit = match.group(2)
        if "day" in unit:
            days = amount
        elif "week" in unit:
            days = amount * 7
        else:
            days = amount * 30
        return self.scheduler.now() + timedelta(days=max(days, 7))

    def classify_goal(self, goal_text: str) -> str:
        lowered = goal_text.lower()
        for domain, keywords in DOMAIN_KEYWORDS.items():
            if any(keyword in lowered for keyword in keywords):
                return domain
        return "generic_execution"

    def build_plan(
        self,
        goal_text: str,
        description: str | None,
        deadline: datetime | None,
        busy_windows: list[BusyWindow],
        detailed_plan_text: str | None = None,
    ) -> GoalDecompositionResult:
        if detailed_plan_text:
            parsed_blueprint = self.parse_detailed_plan_text(detailed_plan_text)
            if parsed_blueprint:
                return self.render_plan_from_blueprint(
                    domain=self.classify_goal(goal_text),
                    goal_text=goal_text,
                    description=description,
                    deadline=deadline,
                    busy_windows=busy_windows,
                    blueprint=parsed_blueprint,
                    append_goal_context=False,
                )

        domain = self.classify_goal(goal_text)
        blueprint = BLUEPRINTS[domain]
        return self.render_plan_from_blueprint(
            domain=domain,
            goal_text=goal_text,
            description=description,
            deadline=deadline,
            busy_windows=busy_windows,
            blueprint=blueprint,
        )

    def render_plan_from_blueprint(
        self,
        *,
        domain: str,
        goal_text: str,
        description: str | None,
        deadline: datetime | None,
        busy_windows: list[BusyWindow],
        blueprint: list[BlueprintTask],
        append_goal_context: bool = True,
    ) -> GoalDecompositionResult:
        resolved_deadline = self.scheduler.ensure_utc(
            deadline or self.infer_deadline(goal_text)
        )
        planning_start = self.scheduler.now() + timedelta(hours=2)
        total_days = max((resolved_deadline - planning_start).days, 7)
        cadence_days = max(total_days // max(len(blueprint), 1), 1)

        scheduled_tasks: list[dict] = []
        task_end_by_key: dict[str, datetime] = {}
        task_start_by_key: dict[str, datetime] = {}
        occupied = list(busy_windows)

        for index, draft in enumerate(blueprint):
            dependency_end = max(
                (task_end_by_key[key] for key in draft.depends_on),
                default=planning_start,
            )
            cadence_anchor = planning_start + timedelta(days=index * cadence_days)
            earliest = max(dependency_end, cadence_anchor)
            slot = self.scheduler.find_next_slot(
                duration_minutes=draft.estimated_minutes,
                busy_windows=occupied,
                after=earliest,
            )
            if slot is None:
                slot = self.scheduler.find_next_slot(
                    duration_minutes=draft.estimated_minutes,
                    busy_windows=occupied,
                    after=dependency_end,
                    horizon_days=120,
                )
            if slot is None:
                raise ValueError("Unable to schedule a task slot for the generated plan.")

            start_at, end_at = slot
            occupied.append(BusyWindow(start_at=start_at, end_at=end_at))
            task_start_by_key[draft.key] = start_at
            task_end_by_key[draft.key] = end_at

            rendered_description = draft.description
            if description and append_goal_context:
                rendered_description = (
                    f"{draft.description} Goal context: {description.strip()}"
                )

            scheduled_tasks.append(
                {
                    "key": draft.key,
                    "title": draft.title,
                    "description": rendered_description,
                    "phase": draft.phase,
                    "estimated_minutes": draft.estimated_minutes,
                    "depends_on": list(draft.depends_on),
                    "scheduled_start": start_at,
                    "scheduled_end": end_at,
                    "milestone": draft.milestone,
                    "goal_title": goal_text,
                    "order_index": index,
                }
            )

        dag = {
            "domain": domain,
            "nodes": [
                {
                    "key": task["key"],
                    "title": task["title"],
                    "phase": task["phase"],
                    "estimated_minutes": task["estimated_minutes"],
                    "depends_on": task["depends_on"],
                    "scheduled_start": task["scheduled_start"],
                    "scheduled_end": task["scheduled_end"],
                    "milestone": task["milestone"],
                }
                for task in scheduled_tasks
            ],
            "edges": [
                {"from_node": dependency, "to_node": task["key"]}
                for task in scheduled_tasks
                for dependency in task["depends_on"]
            ],
            "milestones": [
                task["key"] for task in scheduled_tasks if task["milestone"]
            ],
        }
        return GoalDecompositionResult(
            domain=domain,
            deadline=resolved_deadline,
            tasks=scheduled_tasks,
            dag=dag,
        )

    def parse_detailed_plan_text(self, plan_text: str) -> list[BlueprintTask]:
        current_phase = "execution"
        current_phase_number = 1
        default_minutes = self._extract_default_minutes(plan_text)
        parsed_tasks: list[BlueprintTask] = []
        previous_key: str | None = None

        for raw_line in plan_text.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            phase_match = PHASE_LINE_RE.match(line)
            if phase_match:
                current_phase_number = int(phase_match.group("number"))
                current_phase = self._normalize_phase_name(
                    phase_match.group("title"),
                    current_phase_number,
                )
                continue

            day_match = DAY_LINE_RE.match(line)
            if not day_match:
                continue

            day_number = int(day_match.group("number"))
            body = day_match.group("body").strip()
            milestone = bool(
                re.search(r"(✅|☑️|✔️|\bmilestone\b)", body, re.IGNORECASE)
            )
            body = re.sub(
                r"\s*(?:✅|☑️|✔️)\s*Milestone\b",
                "",
                body,
                flags=re.IGNORECASE,
            ).strip()
            body = re.sub(r"\bMilestone\b", "", body, flags=re.IGNORECASE).strip()

            title, description, estimated_minutes = self._parse_day_body(
                body,
                default_minutes=default_minutes,
            )
            if not title:
                continue

            duration_hours = max(estimated_minutes / 60, 0.5)
            duration_label = (
                str(int(duration_hours))
                if float(duration_hours).is_integer()
                else f"{duration_hours:.1f}".rstrip("0").rstrip(".")
            )
            task_title = f"Day {day_number}: {title} — {duration_label}h"
            task_key = self._build_day_task_key(day_number, title)
            depends_on = (previous_key,) if previous_key else ()

            parsed_tasks.append(
                BlueprintTask(
                    key=task_key,
                    title=task_title,
                    description=description,
                    phase=current_phase,
                    estimated_minutes=estimated_minutes,
                    depends_on=depends_on,
                    milestone=milestone,
                )
            )
            previous_key = task_key

        return parsed_tasks

    def _extract_default_minutes(self, plan_text: str) -> int:
        match = DEFAULT_HOURS_RE.search(plan_text)
        if not match:
            return 120
        return max(int(round(float(match.group("hours")) * 60)), 30)

    def _parse_day_body(
        self,
        body: str,
        *,
        default_minutes: int,
    ) -> tuple[str, str, int]:
        match = DURATION_RE.match(body)
        if match:
            title = match.group("title").strip(" -*")
            description = (
                match.group("description").strip()
                or "Complete the planned focus block for this day."
            )
            minutes = max(int(round(float(match.group("hours")) * 60)), 30)
            return title, description, minutes

        cleaned = body.strip(" -*")
        return cleaned, "Complete the planned focus block for this day.", default_minutes

    def _normalize_phase_name(self, title: str, number: int) -> str:
        slug = self._slugify(title)
        if not slug:
            return f"phase_{number}"
        return f"phase_{number}_{'_'.join(slug.split('_')[:4])}"

    def _build_day_task_key(self, day_number: int, title: str) -> str:
        slug = self._slugify(title)
        if not slug:
            return f"day_{day_number}"
        return f"day_{day_number}_{'_'.join(slug.split('_')[:5])}"

    def _slugify(self, value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


