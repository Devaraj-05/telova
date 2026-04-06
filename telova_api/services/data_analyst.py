from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.config import Settings


ALLOWED_AI_OBJECTS = {
    "telova_goal_execution_secure",
    "telova_schedule_pressure_secure",
    "telova_agent_activity_secure",
}

PROHIBITED_SQL_TOKENS = (
    "insert ",
    "update ",
    "delete ",
    "drop ",
    "alter ",
    "grant ",
    "revoke ",
    "truncate ",
    "create ",
    "merge ",
    "copy ",
)


@dataclass(frozen=True)
class SqlExecutionPlan:
    sql: str
    params: dict[str, Any]
    source_objects: list[str]
    mode: str


class ProductivityDataAnalystService:
    def __init__(
        self,
        *,
        session: AsyncSession,
        settings: Settings,
    ) -> None:
        self.session = session
        self.settings = settings

    async def answer_question(
        self,
        *,
        user_id: str,
        question: str,
        limit: int = 10,
    ) -> dict[str, Any]:
        fallback_reason = None

        if self._can_use_alloydb_ai():
            try:
                generated_sql = await self._generate_alloydb_sql(
                    user_id=user_id,
                    question=question,
                )
                cleaned_sql = self._normalize_sql_text(generated_sql)
                source_objects = self._validate_ai_sql(cleaned_sql)
                rows = await self._execute_sql(
                    cleaned_sql,
                    params={"result_limit": limit},
                )
                return {
                    "question": question,
                    "summary": self._summarize_rows(question, rows),
                    "generated_sql": cleaned_sql,
                    "rows": rows,
                    "row_count": len(rows),
                    "execution_mode": "alloydb_ai_nl",
                    "source_objects": source_objects,
                    "fallback_reason": None,
                }
            except Exception as exc:
                fallback_reason = str(exc)

        plan = self._build_fallback_plan(
            user_id=user_id,
            question=question,
            limit=limit,
        )
        rows = await self._execute_sql(plan.sql, params=plan.params)
        return {
            "question": question,
            "summary": self._summarize_rows(question, rows),
            "generated_sql": plan.sql,
            "rows": rows,
            "row_count": len(rows),
            "execution_mode": plan.mode,
            "source_objects": plan.source_objects,
            "fallback_reason": fallback_reason,
        }

    def describe_status(self) -> dict[str, str]:
        if self._can_use_alloydb_ai():
            return {
                "name": "AlloyDB AI Analyst",
                "status": "ready",
                "detail": (
                    "Natural-language SQL generation is enabled against AlloyDB "
                    f"config {self.settings.alloydb_ai_nl_config_id}."
                ),
            }
        return {
            "name": "AlloyDB AI Analyst",
            "status": "warning",
            "detail": (
                "Falling back to deterministic SQL templates until AlloyDB AI "
                "natural language is configured."
            ),
        }

    def _can_use_alloydb_ai(self) -> bool:
        dialect = self.session.bind.dialect.name if self.session.bind else ""
        return bool(
            self.settings.alloydb_ai_nl_enabled
            and self.settings.alloydb_ai_nl_config_id
            and dialect == "postgresql"
        )

    async def _generate_alloydb_sql(self, *, user_id: str, question: str) -> str:
        await self.session.execute(
            text("SELECT set_config('telova.user_id', :user_id, true)"),
            {"user_id": user_id},
        )
        result = await self.session.execute(
            text(
                """
                SELECT alloydb_ai_nl.get_sql(
                    nl_config_id => :config_id,
                    nl_question => :question,
                    additional_info => json_build_object('enrich_nl_question', TRUE)
                ) ->> 'sql' AS sql
                """
            ),
            {
                "config_id": self.settings.alloydb_ai_nl_config_id,
                "question": question,
            },
        )
        sql = result.scalar_one_or_none()
        if not sql:
            raise RuntimeError("AlloyDB AI did not return a SQL statement.")
        return sql

    async def _execute_sql(
        self,
        sql_text: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        result = await self.session.execute(text(sql_text), params or {})
        return [dict(row) for row in result.mappings().all()]

    def _build_fallback_plan(
        self,
        *,
        user_id: str,
        question: str,
        limit: int,
    ) -> SqlExecutionPlan:
        now = datetime.now(timezone.utc)
        lower = question.lower()

        if "overdue" in lower:
            return SqlExecutionPlan(
                sql="""
                    SELECT
                      g.title AS goal_title,
                      t.title AS task_title,
                      t.status,
                      t.scheduled_end,
                      g.deadline
                    FROM tasks AS t
                    INNER JOIN goals AS g ON g.id = t.goal_id
                    WHERE g.user_id = :user_id
                      AND g.status = 'active'
                      AND t.status != 'done'
                      AND t.scheduled_end IS NOT NULL
                      AND t.scheduled_end < :window_end
                    ORDER BY t.scheduled_end ASC
                    LIMIT :result_limit
                """,
                params={
                    "user_id": user_id,
                    "window_end": now.isoformat(),
                    "result_limit": limit,
                },
                source_objects=["goals", "tasks"],
                mode="deterministic_sql",
            )

        if "blocked" in lower:
            return SqlExecutionPlan(
                sql="""
                    SELECT
                      g.title AS goal_title,
                      t.title AS task_title,
                      t.phase,
                      t.status,
                      g.deadline
                    FROM tasks AS t
                    INNER JOIN goals AS g ON g.id = t.goal_id
                    WHERE g.user_id = :user_id
                      AND t.status = 'blocked'
                    ORDER BY g.deadline ASC, t.updated_at DESC
                    LIMIT :result_limit
                """,
                params={"user_id": user_id, "result_limit": limit},
                source_objects=["goals", "tasks"],
                mode="deterministic_sql",
            )

        if "tomorrow" in lower:
            window_start = (now + timedelta(days=1)).replace(
                hour=0,
                minute=0,
                second=0,
                microsecond=0,
            )
            window_end = window_start + timedelta(days=1)
            return SqlExecutionPlan(
                sql="""
                    SELECT
                      g.title AS goal_title,
                      t.title AS task_title,
                      t.phase,
                      t.scheduled_start,
                      t.scheduled_end
                    FROM tasks AS t
                    INNER JOIN goals AS g ON g.id = t.goal_id
                    WHERE g.user_id = :user_id
                      AND t.scheduled_start >= :window_start
                      AND t.scheduled_start < :window_end
                    ORDER BY t.scheduled_start ASC
                    LIMIT :result_limit
                """,
                params={
                    "user_id": user_id,
                    "window_start": window_start.isoformat(),
                    "window_end": window_end.isoformat(),
                    "result_limit": limit,
                },
                source_objects=["goals", "tasks"],
                mode="deterministic_sql",
            )

        if "today" in lower or "schedule" in lower:
            window_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            window_end = window_start + timedelta(days=1)
            return SqlExecutionPlan(
                sql="""
                    SELECT
                      e.title AS schedule_title,
                      e.source,
                      e.start_at,
                      e.end_at,
                      COALESCE(g.title, 'Unlinked') AS goal_title
                    FROM calendar_events AS e
                    LEFT JOIN goals AS g ON g.id = e.goal_id
                    WHERE e.user_id = :user_id
                      AND e.start_at >= :window_start
                      AND e.start_at < :window_end
                    ORDER BY e.start_at ASC
                    LIMIT :result_limit
                """,
                params={
                    "user_id": user_id,
                    "window_start": window_start.isoformat(),
                    "window_end": window_end.isoformat(),
                    "result_limit": limit,
                },
                source_objects=["calendar_events", "goals"],
                mode="deterministic_sql",
            )

        if "deviation" in lower or "risk" in lower or "at risk" in lower:
            return SqlExecutionPlan(
                sql="""
                    SELECT
                      g.title AS goal_title,
                      g.domain,
                      g.deviation,
                      g.deadline,
                      COUNT(t.id) AS total_tasks,
                      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS completed_tasks
                    FROM goals AS g
                    LEFT JOIN tasks AS t ON t.goal_id = g.id
                    WHERE g.user_id = :user_id
                    GROUP BY g.id, g.title, g.domain, g.deviation, g.deadline
                    ORDER BY g.deviation DESC, g.deadline ASC
                    LIMIT :result_limit
                """,
                params={"user_id": user_id, "result_limit": limit},
                source_objects=["goals", "tasks"],
                mode="deterministic_sql",
            )

        if "completed" in lower or "finished" in lower:
            completed_since = now - timedelta(days=7)
            return SqlExecutionPlan(
                sql="""
                    SELECT
                      t.title AS task_title,
                      COALESCE(g.title, 'Unlinked') AS goal_title,
                      t.completed_at,
                      t.phase
                    FROM tasks AS t
                    LEFT JOIN goals AS g ON g.id = t.goal_id
                    WHERE t.user_id = :user_id
                      AND t.status = 'done'
                      AND t.completed_at IS NOT NULL
                      AND t.completed_at >= :completed_since
                    ORDER BY t.completed_at DESC
                    LIMIT :result_limit
                """,
                params={
                    "user_id": user_id,
                    "completed_since": completed_since.isoformat(),
                    "result_limit": limit,
                },
                source_objects=["tasks", "goals"],
                mode="deterministic_sql",
            )

        return SqlExecutionPlan(
            sql="""
                SELECT
                  g.title AS goal_title,
                  g.domain,
                  g.status,
                  g.deadline,
                  g.deviation,
                  COUNT(t.id) AS total_tasks,
                  SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS completed_tasks,
                  SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked_tasks
                FROM goals AS g
                LEFT JOIN tasks AS t ON t.goal_id = g.id
                WHERE g.user_id = :user_id
                GROUP BY g.id, g.title, g.domain, g.status, g.deadline, g.deviation
                ORDER BY g.updated_at DESC
                LIMIT :result_limit
            """,
            params={"user_id": user_id, "result_limit": limit},
            source_objects=["goals", "tasks"],
            mode="deterministic_sql",
        )

    def _normalize_sql_text(self, sql_text: str) -> str:
        cleaned = sql_text.strip()
        cleaned = re.sub(r"^```(?:sql)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
        cleaned = cleaned.rstrip(";").strip()
        if not cleaned:
            raise RuntimeError("Generated SQL was empty.")
        return f"SELECT * FROM ({cleaned}) AS telova_ai_result LIMIT :result_limit"

    def _validate_ai_sql(self, sql_text: str) -> list[str]:
        lowered = sql_text.lower()
        if not lowered.startswith("select"):
            raise RuntimeError("Generated SQL must be read-only.")
        if any(token in lowered for token in PROHIBITED_SQL_TOKENS):
            raise RuntimeError("Generated SQL contains a prohibited operation.")

        source_objects = self._extract_referenced_objects(lowered)
        if not source_objects:
            raise RuntimeError(
                "Generated SQL did not reference the curated Telova secure views."
            )

        disallowed = [
            source
            for source in source_objects
            if source not in ALLOWED_AI_OBJECTS
        ]
        if disallowed:
            raise RuntimeError(
                "Generated SQL referenced unexpected objects: "
                + ", ".join(sorted(disallowed))
            )
        return sorted(set(source_objects))

    def _extract_referenced_objects(self, sql_text: str) -> list[str]:
        matches = re.findall(
            r"\b(?:from|join)\s+([a-zA-Z0-9_\.]+)",
            sql_text,
            flags=re.IGNORECASE,
        )
        normalized = []
        for match in matches:
            normalized.append(match.split(".")[-1].strip('"'))
        return normalized

    def _summarize_rows(
        self,
        question: str,
        rows: list[dict[str, Any]],
    ) -> str:
        del question
        if not rows:
            return "No matching records were found for that productivity question."

        if len(rows) == 1:
            preview = ", ".join(
                f"{key}={self._format_value(value)}"
                for key, value in list(rows[0].items())[:4]
            )
            return f"I found 1 matching record. Top result: {preview}."

        first = rows[0]
        preview = ", ".join(
            f"{key}={self._format_value(value)}"
            for key, value in list(first.items())[:3]
        )
        return (
            f"I found {len(rows)} matching rows. The top result is {preview}. "
            "Review the returned rows for the full detail."
        )

    def _format_value(self, value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)
