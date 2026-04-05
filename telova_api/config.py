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
    auto_resolve_conflicts: bool
    progress_deviation_threshold: float
    default_user_id: str
    alloydb_instance_name: str | None
    alloydb_database: str | None
    alloydb_user: str | None
    alloydb_password: str | None
    alloydb_refresh_strategy: str
    alloydb_ip_type: str | None


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
        auto_resolve_conflicts=_as_bool(
            os.getenv("AUTO_RESOLVE_CONFLICTS", "false")
        ),
        progress_deviation_threshold=float(
            os.getenv("PROGRESS_DEVIATION_THRESHOLD", "0.20")
        ),
        default_user_id=os.getenv("DEFAULT_USER_ID", "demo-user"),
        alloydb_instance_name=os.getenv("ALLOYDB_INSTANCE_NAME") or None,
        alloydb_database=os.getenv("ALLOYDB_DATABASE") or None,
        alloydb_user=os.getenv("ALLOYDB_USER") or None,
        alloydb_password=os.getenv("ALLOYDB_PASSWORD") or None,
        alloydb_refresh_strategy=os.getenv("ALLOYDB_REFRESH_STRATEGY", "lazy"),
        alloydb_ip_type=os.getenv("ALLOYDB_IP_TYPE") or None,
    )

