from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from hmac import compare_digest
import logging
import time
from uuid import uuid4

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


logger = logging.getLogger("telova.access")


def _auth_header_token(request: Request) -> str | None:
    header = request.headers.get("Authorization", "").strip()
    if not header:
        header = request.headers.get("X-Authorization", "").strip()
    if not header:
        return None
    parts = header.split(" ", maxsplit=1)
    if len(parts) != 2:
        return None
    scheme, token = parts
    if scheme.lower() != "bearer":
        return None
    return token.strip() or None


def _request_key(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "anonymous"


def _api_key_from_request(request: Request) -> str | None:
    return (
        request.headers.get("X-Telova-API-Key")
        or _auth_header_token(request)
        or None
    )


def _cron_token_from_request(request: Request) -> str | None:
    return (
        request.headers.get("X-Telova-Cron-Token")
        or _auth_header_token(request)
        or None
    )


@dataclass
class SlidingWindowRateLimiter:
    limit: int
    window_seconds: int

    def __post_init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> tuple[bool, int]:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        bucket = self._buckets[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= self.limit:
            retry_after = max(int(self.window_seconds - (now - bucket[0])), 1)
            return False, retry_after
        bucket.append(now)
        return True, 0


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        started_at = time.perf_counter()
        request.state.request_id = request_id

        response = await call_next(request)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["X-Response-Time-Ms"] = str(
            round((time.perf_counter() - started_at) * 1000)
        )
        return response


class StructuredAccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        started_at = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - started_at) * 1000)
            logger.exception(
                "request_failed",
                extra={
                    "payload": {
                        "request_id": getattr(request.state, "request_id", None),
                        "method": request.method,
                        "path": request.url.path,
                        "duration_ms": duration_ms,
                        "client": _request_key(request),
                    }
                },
            )
            raise

        duration_ms = round((time.perf_counter() - started_at) * 1000)
        logger.info(
            "request_completed",
            extra={
                "payload": {
                    "request_id": getattr(request.state, "request_id", None),
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "client": _request_key(request),
                }
            },
        )
        return response


class ApiAuthMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        auth_mode: str,
        api_key: str | None = None,
        cron_token: str | None = None,
    ) -> None:
        super().__init__(app)
        self.auth_mode = auth_mode.strip().lower()
        self.api_key = api_key or None
        self.cron_token = cron_token or None

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)
        if self.auth_mode == "disabled":
            return await call_next(request)
        if path in {"/api/openapi.json"} or path.startswith("/api/v1/auth/"):
            return await call_next(request)

        is_cron_path = path.startswith("/api/v1/webhooks/cron/")
        provided_api_key = _api_key_from_request(request)
        provided_cron_token = _cron_token_from_request(request)

        authorized = False
        if self.api_key and provided_api_key:
            authorized = compare_digest(provided_api_key, self.api_key)
        if is_cron_path and self.cron_token and provided_cron_token:
            authorized = authorized or compare_digest(
                provided_cron_token,
                self.cron_token,
            )

        if authorized:
            return await call_next(request)

        detail = "Missing or invalid API credentials."
        if is_cron_path and self.cron_token:
            detail = "Missing or invalid cron credentials."
        return JSONResponse(status_code=401, content={"detail": detail})


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        enabled: bool,
        limit: int,
        window_seconds: int,
    ) -> None:
        super().__init__(app)
        self.enabled = enabled
        self.limiter = SlidingWindowRateLimiter(
            limit=max(limit, 1),
            window_seconds=max(window_seconds, 1),
        )

    async def dispatch(self, request: Request, call_next):
        if not self.enabled or not request.url.path.startswith("/api/"):
            return await call_next(request)

        allowed, retry_after = self.limiter.allow(_request_key(request))
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded."},
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)
