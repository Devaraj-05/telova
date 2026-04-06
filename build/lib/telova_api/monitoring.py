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

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
    configure_monitoring._configured = True
