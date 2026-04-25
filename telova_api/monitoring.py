from __future__ import annotations

import logging

from telova_api.config import Settings


logger = logging.getLogger(__name__)


def configure_monitoring(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    if getattr(configure_monitoring, "_configured", False):
        return

    try:
        import sentry_sdk
    except ImportError:
        logger.warning(
            "SENTRY_DSN is configured, but sentry-sdk is not installed. "
            "Skipping error monitoring setup."
        )
        return

    integrations: list = []
    try:
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        integrations = [StarletteIntegration(transaction_style="url"), FastApiIntegration()]
    except ImportError:
        logger.warning(
            "sentry-sdk FastAPI integration unavailable; falling back to base init. "
            "Install sentry-sdk[fastapi] for full route instrumentation."
        )

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=0.1,
        send_default_pii=False,
        integrations=integrations,
    )
    configure_monitoring._configured = True
