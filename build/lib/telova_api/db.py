from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from telova_api.config import get_settings
from telova_api.secrets import SecretResolver


class Base(DeclarativeBase):
    """Base ORM model."""


settings = get_settings()
secret_resolver = SecretResolver(settings)
_alloydb_connector = None


def _build_engine() -> AsyncEngine:
    global _alloydb_connector

    alloydb_password = secret_resolver.resolve_text(
        inline_value=settings.alloydb_password,
        secret_name=settings.alloydb_password_secret,
        label="AlloyDB password",
    )

    if (
        settings.alloydb_instance_name
        and settings.alloydb_database
        and settings.alloydb_user
        and (alloydb_password or settings.alloydb_enable_iam_auth)
    ):
        try:
            from google.cloud.alloydbconnector import AsyncConnector, IPTypes
        except ImportError as exc:
            raise RuntimeError(
                "AlloyDB settings are configured but the connector is not installed. "
                "Install the optional GCP dependencies with "
                "`pip install .[gcp]` or "
                "`pip install \"google-cloud-alloydb-connector[asyncpg]\" asyncpg`."
            ) from exc

        _alloydb_connector = AsyncConnector(
            refresh_strategy=settings.alloydb_refresh_strategy
        )

        async def get_connection():
            connector_kwargs = {}
            if settings.alloydb_ip_type:
                connector_kwargs["ip_type"] = getattr(
                    IPTypes,
                    settings.alloydb_ip_type.upper(),
                )
            if settings.alloydb_enable_iam_auth:
                connector_kwargs["enable_iam_auth"] = True
            return await _alloydb_connector.connect(
                settings.alloydb_instance_name,
                "asyncpg",
                user=settings.alloydb_user,
                password=alloydb_password or "",
                db=settings.alloydb_database,
                **connector_kwargs,
            )

        return create_async_engine(
            "postgresql+asyncpg://",
            async_creator=get_connection,
            future=True,
            echo=False,
            pool_pre_ping=True,
        )

    return create_async_engine(
        settings.database_url,
        future=True,
        echo=False,
    )


engine: AsyncEngine = _build_engine()
SessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def init_db() -> None:
    from telova_api import models  # noqa: F401

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    session = SessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_session() -> AsyncIterator[AsyncSession]:
    async with session_scope() as session:
        yield session


async def close_db() -> None:
    global _alloydb_connector

    await engine.dispose()
    if _alloydb_connector is not None:
        await _alloydb_connector.close()
        _alloydb_connector = None

