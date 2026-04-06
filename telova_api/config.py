from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os


def _as_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_env: str
    app_timezone: str
    database_url: str
    integration_backend: str
    agent_runtime: str
    auto_resolve_conflicts: bool
    progress_deviation_threshold: float
    default_user_id: str
    gcp_project_id: str | None
    gcp_region: str
    use_secret_manager: bool
    alloydb_instance_name: str | None
    alloydb_database: str | None
    alloydb_user: str | None
    alloydb_password: str | None
    alloydb_password_secret: str | None
    alloydb_refresh_strategy: str
    alloydb_ip_type: str | None
    alloydb_enable_iam_auth: bool
    alloydb_ai_nl_enabled: bool
    alloydb_ai_nl_config_id: str
    google_workspace_auth_mode: str
    google_workspace_subject: str | None
    google_workspace_authorized_user_json: str | None
    google_workspace_authorized_user_json_file: str | None
    google_workspace_authorized_user_secret: str | None
    google_workspace_service_account_json: str | None
    google_workspace_service_account_json_file: str | None
    google_workspace_service_account_secret: str | None
    google_calendar_id: str
    google_tasks_tasklist_id: str | None
    google_keep_enabled: bool
    adk_model: str
    adk_app_name: str
    api_auth_mode: str
    api_key: str | None
    api_key_secret: str | None
    cron_shared_token: str | None
    cron_shared_token_secret: str | None
    rate_limit_enabled: bool
    rate_limit_requests: int
    rate_limit_window_seconds: int
    json_logs: bool
    enable_access_logs: bool
    sentry_dsn: str | None
    cloud_run_service_url: str | None
    cloud_scheduler_location: str | None
    cloud_scheduler_service_account: str | None
    cron_conflict_scan_schedule: str | None
    cron_weekly_review_schedule: str | None

    @property
    def is_google_backend(self) -> bool:
        return self.integration_backend.strip().lower() == "google"

    @property
    def is_google_adk_runtime(self) -> bool:
        return self.agent_runtime.strip().lower() == "google_adk"

    @property
    def scheduler_ready(self) -> bool:
        return bool(
            self.cloud_run_service_url
            and self.cloud_scheduler_location
            and self.cloud_scheduler_service_account
            and self.cron_conflict_scan_schedule
            and self.cron_weekly_review_schedule
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "Telova API"),
        app_env=os.getenv("APP_ENV", "development"),
        app_timezone=os.getenv("APP_TIMEZONE", "Asia/Kolkata"),
        database_url=os.getenv(
            "DATABASE_URL",
            "sqlite+aiosqlite:///./telova.db",
        ),
        integration_backend=os.getenv("INTEGRATION_BACKEND", "database"),
        agent_runtime=os.getenv("AGENT_RUNTIME", "deterministic"),
        auto_resolve_conflicts=_as_bool(
            os.getenv("AUTO_RESOLVE_CONFLICTS", "false")
        ),
        progress_deviation_threshold=float(
            os.getenv("PROGRESS_DEVIATION_THRESHOLD", "0.20")
        ),
        default_user_id=os.getenv("DEFAULT_USER_ID", "demo-user"),
        gcp_project_id=os.getenv("GCP_PROJECT_ID") or None,
        gcp_region=os.getenv("GCP_REGION", "us-central1"),
        use_secret_manager=_as_bool(
            os.getenv("USE_SECRET_MANAGER", "false")
        ),
        alloydb_instance_name=os.getenv("ALLOYDB_INSTANCE_NAME") or None,
        alloydb_database=os.getenv("ALLOYDB_DATABASE") or None,
        alloydb_user=os.getenv("ALLOYDB_USER") or None,
        alloydb_password=os.getenv("ALLOYDB_PASSWORD") or None,
        alloydb_password_secret=os.getenv("ALLOYDB_PASSWORD_SECRET") or None,
        alloydb_refresh_strategy=os.getenv("ALLOYDB_REFRESH_STRATEGY", "lazy"),
        alloydb_ip_type=os.getenv("ALLOYDB_IP_TYPE") or None,
        alloydb_enable_iam_auth=_as_bool(
            os.getenv("ALLOYDB_ENABLE_IAM_AUTH", "false")
        ),
        alloydb_ai_nl_enabled=_as_bool(
            os.getenv("ALLOYDB_AI_NL_ENABLED", "false")
        ),
        alloydb_ai_nl_config_id=os.getenv(
            "ALLOYDB_AI_NL_CONFIG_ID",
            "telova_nl",
        ),
        google_workspace_auth_mode=os.getenv(
            "GOOGLE_WORKSPACE_AUTH_MODE",
            "disabled",
        ),
        google_workspace_subject=os.getenv("GOOGLE_WORKSPACE_SUBJECT") or None,
        google_workspace_authorized_user_json=os.getenv(
            "GOOGLE_WORKSPACE_AUTHORIZED_USER_JSON"
        )
        or None,
        google_workspace_authorized_user_json_file=os.getenv(
            "GOOGLE_WORKSPACE_AUTHORIZED_USER_JSON_FILE"
        )
        or None,
        google_workspace_authorized_user_secret=os.getenv(
            "GOOGLE_WORKSPACE_AUTHORIZED_USER_SECRET"
        )
        or None,
        google_workspace_service_account_json=os.getenv(
            "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON"
        )
        or None,
        google_workspace_service_account_json_file=os.getenv(
            "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON_FILE"
        )
        or None,
        google_workspace_service_account_secret=os.getenv(
            "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_SECRET"
        )
        or None,
        google_calendar_id=os.getenv("GOOGLE_CALENDAR_ID", "primary"),
        google_tasks_tasklist_id=os.getenv("GOOGLE_TASKS_TASKLIST_ID") or None,
        google_keep_enabled=_as_bool(
            os.getenv("GOOGLE_KEEP_ENABLED", "false")
        ),
        adk_model=os.getenv("ADK_MODEL", "gemini-2.0-flash"),
        adk_app_name=os.getenv("ADK_APP_NAME", "telova"),
        api_auth_mode=os.getenv("API_AUTH_MODE", "disabled"),
        api_key=os.getenv("API_KEY") or None,
        api_key_secret=os.getenv("API_KEY_SECRET") or None,
        cron_shared_token=os.getenv("CRON_SHARED_TOKEN") or None,
        cron_shared_token_secret=os.getenv("CRON_SHARED_TOKEN_SECRET") or None,
        rate_limit_enabled=_as_bool(
            os.getenv("RATE_LIMIT_ENABLED", "true")
        ),
        rate_limit_requests=int(os.getenv("RATE_LIMIT_REQUESTS", "120")),
        rate_limit_window_seconds=int(
            os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")
        ),
        json_logs=_as_bool(os.getenv("JSON_LOGS", "true"), default=True),
        enable_access_logs=_as_bool(
            os.getenv("ENABLE_ACCESS_LOGS", "true"),
            default=True,
        ),
        sentry_dsn=os.getenv("SENTRY_DSN") or None,
        cloud_run_service_url=os.getenv("CLOUD_RUN_SERVICE_URL") or None,
        cloud_scheduler_location=os.getenv("CLOUD_SCHEDULER_LOCATION") or None,
        cloud_scheduler_service_account=os.getenv(
            "CLOUD_SCHEDULER_SERVICE_ACCOUNT"
        )
        or None,
        cron_conflict_scan_schedule=os.getenv("CRON_CONFLICT_SCAN_SCHEDULE")
        or None,
        cron_weekly_review_schedule=os.getenv("CRON_WEEKLY_REVIEW_SCHEDULE")
        or None,
    )

