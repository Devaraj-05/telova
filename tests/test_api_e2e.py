from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telova_api.main import app
from telova_api.security import ApiAuthMiddleware
import telova_api.db as db_module


@pytest.fixture
def client(tmp_path):
    test_db_path = tmp_path / "telova-test.db"
    test_engine = create_async_engine(
        f"sqlite+aiosqlite:///{test_db_path.as_posix()}",
        future=True,
        echo=False,
    )
    test_session = async_sessionmaker(
        bind=test_engine,
        expire_on_commit=False,
        class_=AsyncSession,
    )

    original_engine = db_module.engine
    original_session_local = db_module.SessionLocal
    db_module.engine = test_engine
    db_module.SessionLocal = test_session

    with TestClient(app) as test_client:
        yield test_client

    db_module.engine = original_engine
    db_module.SessionLocal = original_session_local


def test_goal_plan_conflict_scan_flow(client: TestClient):
    plan_response = client.post(
        "/api/v1/goals",
        json={
            "user_id": "demo-user",
            "goal": "Launch an MVP in 4 weeks",
            "description": "Need a demo-ready build with validation.",
        },
    )
    assert plan_response.status_code == 200
    plan = plan_response.json()
    assert plan["tasks"]

    first_task = plan["tasks"][0]
    event_response = client.post(
        "/api/v1/calendar/events",
        json={
            "user_id": "demo-user",
            "title": "Customer review",
            "description": "Intentional overlap for conflict testing.",
            "start_at": first_task["scheduled_start"],
            "end_at": first_task["scheduled_end"],
            "goal_id": plan["goal"]["id"],
            "task_id": first_task["id"],
        },
    )
    assert event_response.status_code == 200

    conflict_response = client.post(
        "/api/v1/webhooks/cron/conflict-check",
        json={"user_id": "demo-user", "auto_resolve": False},
    )
    assert conflict_response.status_code == 200
    alerts = conflict_response.json()
    assert alerts
    assert alerts[0]["task_id"] == first_task["id"]


def test_goal_preview_then_create_flow(client: TestClient):
    preview_response = client.post(
        "/api/v1/goals/preview",
        json={
            "user_id": "demo-user",
            "goal": "Get promoted to Senior Engineer",
            "description": "Need stronger leadership evidence.",
            "priority": "High",
            "constraints": [
                "Weekday focus blocks only",
                "Avoid meetings after 6 PM",
            ],
        },
    )
    assert preview_response.status_code == 200
    preview = preview_response.json()
    assert preview["tasks"]
    assert preview["dag"]["nodes"]
    assert "Priority is set to High" in preview["summary"]

    goal_list_before = client.get("/api/v1/goals", params={"user_id": "demo-user"})
    assert goal_list_before.status_code == 200
    before_count = len(goal_list_before.json())

    create_response = client.post(
        "/api/v1/goals",
        json={
            "user_id": "demo-user",
            "goal": "Get promoted to Senior Engineer",
            "description": "Need stronger leadership evidence.",
            "priority": "High",
            "constraints": [
                "Weekday focus blocks only",
                "Avoid meetings after 6 PM",
            ],
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["tasks"]

    goal_list_after = client.get("/api/v1/goals", params={"user_id": "demo-user"})
    assert goal_list_after.status_code == 200
    assert len(goal_list_after.json()) == before_count + 1


def test_goal_plan_uses_detailed_day_plan_for_tasks_and_calendar_titles(client: TestClient):
    detailed_plan_text = (
        "Timeline: 2 months\n"
        "Daily Commitment: 2 hours per day\n"
        "Phase 1: AI/ML Foundations — Week 1-2\n"
        "Day 1 (Mon): Python Data Structures & Algorithms Refresher — 2h. "
        "Review Python lists, dictionaries, sets, and tuples.\n"
        "Day 2 (Tue): Object-Oriented Programming in Python — 2h. "
        "Implement a simple bank account class system."
    )

    preview_response = client.post(
        "/api/v1/goals/preview",
        json={
            "user_id": "demo-user",
            "goal": "I want to Get a Job for AI Engineer Role",
            "description": "Need a day-by-day schedule.",
            "detailed_plan_text": detailed_plan_text,
        },
    )
    assert preview_response.status_code == 200
    preview = preview_response.json()
    assert preview["tasks"][0]["title"] == "Day 1: Python Data Structures & Algorithms Refresher — 2h"
    assert preview["tasks"][1]["title"] == "Day 2: Object-Oriented Programming in Python — 2h"

    create_response = client.post(
        "/api/v1/goals",
        json={
            "user_id": "demo-user",
            "goal": "I want to Get a Job for AI Engineer Role",
            "description": "Need a day-by-day schedule.",
            "detailed_plan_text": detailed_plan_text,
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["tasks"][0]["title"] == "Day 1: Python Data Structures & Algorithms Refresher — 2h"
    assert created["calendar_events"][0]["title"].startswith("AI Engineer: Day 1:")


def test_notes_create_and_update_flow(client: TestClient):
    note_response = client.post(
        "/api/v1/notes",
        json={
            "user_id": "demo-user",
            "title": "Daily brief",
            "content": "Capture blockers and next actions.",
            "note_type": "manual",
        },
    )
    assert note_response.status_code == 200
    note = note_response.json()
    assert note["title"] == "Daily brief"

    patch_response = client.patch(
        f"/api/v1/notes/{note['id']}",
        json={"content": "Updated execution notes."},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["content"] == "Updated execution notes."

    list_response = client.get("/api/v1/notes", params={"user_id": "demo-user"})
    assert list_response.status_code == 200
    assert any(item["id"] == note["id"] for item in list_response.json())


def test_analytics_and_telemetry_endpoints(client: TestClient):
    create_response = client.post(
        "/api/v1/goals",
        json={
            "user_id": "demo-user",
            "goal": "Ship the Telova hackathon demo",
            "description": "Need working analytics, telemetry, and deployment proof.",
            "priority": "High",
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["goal"]["id"]

    analytics_response = client.post(
        "/api/v1/analytics/query",
        json={
            "user_id": "demo-user",
            "question": "Which goal has the highest deviation from plan?",
            "limit": 5,
        },
    )
    assert analytics_response.status_code == 200
    analytics = analytics_response.json()
    assert analytics["generated_sql"]
    assert analytics["row_count"] >= 1
    assert analytics["execution_mode"] in {
        "deterministic_sql",
        "alloydb_ai_nl",
        "vertex_gemini_nl_sql",
    }

    agent_runs_response = client.get(
        "/api/v1/agent-runs",
        params={"user_id": "demo-user", "limit": 20},
    )
    assert agent_runs_response.status_code == 200
    agent_runs = agent_runs_response.json()
    assert any(item["operation"] == "create_goal_plan" for item in agent_runs)
    assert any(item["operation"] == "analytics_query" for item in agent_runs)

    sync_logs_response = client.get(
        "/api/v1/sync-logs",
        params={"user_id": "demo-user", "limit": 50},
    )
    assert sync_logs_response.status_code == 200
    sync_logs = sync_logs_response.json()
    assert sync_logs
    assert any(item["tool_name"] == "calendar" for item in sync_logs)
    assert any(item["tool_name"] == "tasks" for item in sync_logs)
    assert any(item["tool_name"] == "notes" for item in sync_logs)

    system_response = client.get("/api/v1/system/status", params={"user_id": "demo-user"})
    assert system_response.status_code == 200
    system = system_response.json()
    assert any(agent["name"] == "Data Analyst" for agent in system["agents"])
    assert any(check["name"] == "AlloyDB AI NL" for check in system["readiness"])


def test_email_auth_and_google_status_flow(client: TestClient):
    signup_response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": "devaraj@example.com",
            "password": "Telova@123",
            "display_name": "Devaraj",
        },
    )
    assert signup_response.status_code == 200
    signup_payload = signup_response.json()
    token = signup_payload["access_token"]

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "devaraj@example.com"

    google_status_response = client.get(
        "/api/v1/auth/google/status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert google_status_response.status_code == 200
    google_status = google_status_response.json()
    assert google_status["status"] == "disconnected"
    assert google_status["calendar_connected"] is False
    assert google_status["tasks_connected"] is False


def test_api_auth_middleware_enforces_api_key():
    secured = FastAPI()
    secured.add_middleware(
        ApiAuthMiddleware,
        auth_mode="api_key",
        api_key="secret-key",
        cron_token="cron-key",
    )

    @secured.get("/api/ping")
    async def ping():
        return {"ok": True}

    client = TestClient(secured)
    assert client.get("/api/ping").status_code == 401
    assert (
        client.get("/api/ping", headers={"X-Telova-API-Key": "secret-key"}).status_code
        == 200
    )


def test_api_auth_middleware_skips_auth_routes():
    secured = FastAPI()
    secured.add_middleware(
        ApiAuthMiddleware,
        auth_mode="api_key",
        api_key="secret-key",
    )

    @secured.get("/api/v1/auth/ping")
    async def ping():
        return {"ok": True}

    client = TestClient(secured)
    assert client.get("/api/v1/auth/ping").status_code == 200
