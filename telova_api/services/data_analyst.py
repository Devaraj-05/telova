from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
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
        direct_plan = self._build_deterministic_plan_if_supported(
            user_id=user_id,
            question=question,
            limit=limit,
        )
        if direct_plan is not None:
            rows = await self._execute_sql(
                direct_plan.sql,
                params=direct_plan.params,
                workspace_user=user_id,
            )
            return {
                "question": question,
                "summary": self._summarize_rows(question, rows),
                "generated_sql": direct_plan.sql,
                "rows": rows,
                "row_count": len(rows),
                "execution_mode": direct_plan.mode,
                "source_objects": direct_plan.source_objects,
                "fallback_reason": None,
            }

        if self._can_use_vertex_gemini():
            try:
                generated_sql = await self._generate_vertex_sql(
                    user_id=user_id,
                    question=question,
                )
                cleaned_sql = self._normalize_sql_text(generated_sql)
                source_objects = self._validate_ai_sql(cleaned_sql)
                rows = await self._execute_sql(
                    cleaned_sql,
                    params={"result_limit": limit},
                    workspace_user=user_id,
                )
                return {
                    "question": question,
                    "summary": self._summarize_rows(question, rows),
                    "generated_sql": cleaned_sql,
                    "rows": rows,
                    "row_count": len(rows),
                    "execution_mode": "vertex_gemini_nl_sql",
                    "source_objects": source_objects,
                    "fallback_reason": None,
                }
            except Exception as exc:
                fallback_reason = str(exc)
                await self._reset_failed_transaction()

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
                    workspace_user=user_id,
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
                await self._reset_failed_transaction()

        plan = self._build_fallback_plan(
            user_id=user_id,
            question=question,
            limit=limit,
        )
        rows = await self._execute_sql(
            plan.sql,
            params=plan.params,
            workspace_user=user_id,
        )
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
        if self._can_use_vertex_gemini():
            return {
                "name": "Gemini SQL Analyst",
                "status": "ready",
                "detail": (
                    f"Using {self.settings.adk_model} to generate read-only SQL "
                    "against Telova's curated secure views."
                ),
            }
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

    def _can_use_vertex_gemini(self) -> bool:
        model = (self.settings.adk_model or "").strip()
        if not model:
            return False
        if self.settings.google_genai_use_vertexai:
            return bool(
                self.settings.google_cloud_project
                and self.settings.google_cloud_location
            )
        return bool(self.settings.google_api_key)

    def _can_use_alloydb_ai(self) -> bool:
        dialect = self.session.bind.dialect.name if self.session.bind else ""
        return bool(
            self.settings.alloydb_ai_nl_enabled
            and self.settings.alloydb_ai_nl_config_id
            and dialect == "postgresql"
        )

    async def _set_workspace_user(self, user_id: str) -> None:
        dialect = self.session.bind.dialect.name if self.session.bind else ""
        if dialect != "postgresql":
            return
        await self.session.execute(
            text("SELECT set_config('telova.user_id', :user_id, true)"),
            {"user_id": user_id},
        )

    async def _reset_failed_transaction(self) -> None:
        try:
            await self.session.rollback()
        except Exception:
            pass

    async def _generate_vertex_sql(self, *, user_id: str, question: str) -> str:
        await self._set_workspace_user(user_id)
        prompt = self._build_vertex_prompt(question)
        raw_response = await asyncio.to_thread(self._call_vertex_model, prompt)
        payload = self._parse_model_json(raw_response)
        sql = payload.get("sql")
        if not isinstance(sql, str) or not sql.strip():
            raise RuntimeError("Gemini did not return a SQL statement.")
        return sql

    async def _generate_alloydb_sql(self, *, user_id: str, question: str) -> str:
        await self._set_workspace_user(user_id)
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
        workspace_user: str | None = None,
    ) -> list[dict[str, Any]]:
        if workspace_user:
            await self._set_workspace_user(workspace_user)
        result = await self.session.execute(text(sql_text), params or {})
        return [dict(row) for row in result.mappings().all()]

    def _call_vertex_model(self, prompt: str) -> str:
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise RuntimeError(
                "Gemini SQL generation requires the google-genai package."
            ) from exc

        if self.settings.google_genai_use_vertexai:
            client = genai.Client(
                vertexai=True,
                project=self.settings.google_cloud_project,
                location=self.settings.google_cloud_location,
                http_options=types.HttpOptions(api_version="v1"),
            )
        else:
            client = genai.Client(
                api_key=self.settings.google_api_key,
                http_options=types.HttpOptions(api_version="v1"),
            )

        try:
            response = client.models.generate_content(
                model=self.settings.adk_model,
                contents=prompt,
            )
            text_response = getattr(response, "text", "") or ""
        finally:
            try:
                client.close()
            except Exception:
                pass

        if not text_response.strip():
            raise RuntimeError("Gemini returned an empty response.")
        return text_response

    def _build_vertex_prompt(self, question: str) -> str:
        return (
            "You are Telova's SQL analyst.\n"
            "Return only a JSON object with keys sql and source_objects.\n"
            "Generate exactly one read-only PostgreSQL SELECT statement.\n"
            "Use only these views: public.telova_goal_execution_secure, "
            "public.telova_schedule_pressure_secure, public.telova_agent_activity_secure.\n"
            "Do not reference any other tables, views, or schemas.\n"
            "Available columns:\n"
            "- telova_goal_execution_secure: goal_id, user_id, goal_title, domain, goal_status, "
            "deadline, deviation, total_tasks, completed_tasks, blocked_tasks, overdue_tasks.\n"
            "- telova_schedule_pressure_secure: goal_id, user_id, goal_title, goal_status, task_id, "
            "task_title, phase, task_status, estimated_minutes, scheduled_start, scheduled_end, "
            "is_overdue, is_blocked, calendar_event_id, calendar_title, calendar_source.\n"
            "- telova_agent_activity_secure: agent_run_id, user_id, goal_id, agent_name, operation, "
            "status, runtime, started_at, completed_at, tool_name, sync_operation, sync_status, sync_created_at.\n"
            "Use goal_title instead of goal_name, task_status instead of task status, and scheduled_end instead of due_at.\n"
            "The secure views are already scoped by current_setting('telova.user_id', true).\n"
            "Prefer concise SQL and include ORDER BY when useful.\n"
            "Question: "
            f"{question}"
        )

    def _parse_model_json(self, raw_response: str) -> dict[str, Any]:
        cleaned = raw_response.strip()
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise RuntimeError("Gemini returned a non-JSON SQL payload.") from None
            parsed = json.loads(cleaned[start : end + 1])

        if not isinstance(parsed, dict):
            raise RuntimeError("Gemini returned an unexpected JSON shape.")
        return parsed

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
                    "window_end": now,
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
                    "window_start": window_start,
                    "window_end": window_end,
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
                    "window_start": window_start,
                    "window_end": window_end,
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
                    "completed_since": completed_since,
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

    def _build_deterministic_plan_if_supported(
        self,
        *,
        user_id: str,
        question: str,
        limit: int,
    ) -> SqlExecutionPlan | None:
        lower = question.lower()
        deterministic_keywords = (
            "overdue",
            "blocked",
            "tomorrow",
            "today",
            "schedule",
            "scheduled",
            "deviation",
            "risk",
            "at risk",
            "completed",
            "finished",
        )
        if not any(keyword in lower for keyword in deterministic_keywords):
            return None
        return self._build_fallback_plan(
            user_id=user_id,
            question=question,
            limit=limit,
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
