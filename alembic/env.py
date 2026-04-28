from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, engine_from_config, pool
from sqlalchemy.ext.asyncio import create_async_engine

from telova_api.config import get_settings
from telova_api.db import Base
from telova_api import models  # noqa: F401


config = context.config
settings = get_settings()
sync_url = (
    settings.database_url.replace("+aiosqlite", "")
    .replace("+asyncpg", "")
)
config.set_main_option("sqlalchemy.url", sync_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    db_url = settings.database_url

    if "+aiosqlite" in db_url:
        asyncio.run(run_async_migrations())
        return

    # For PostgreSQL (including +asyncpg URLs): use sync psycopg2.
    # asyncpg's SSL negotiation with the AlloyDB Auth Proxy is unreliable;
    # psycopg2 + sslmode=disable bypasses the issue entirely.
    pg_url = db_url.replace("+asyncpg", "")
    connectable = create_engine(pg_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(
        settings.database_url,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
