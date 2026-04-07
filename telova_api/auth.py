from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import secrets
from typing import Any

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from telova_api.config import get_settings
from telova_api.db import get_session
from telova_api.repositories.users import UserRepository
from telova_api.security import _auth_header_token


PBKDF2_ITERATIONS = 310_000


def _urlsafe_b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _urlsafe_b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return (
        f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}$"
        f"{_urlsafe_b64encode(digest)}"
    )


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    try:
        algorithm, iterations, salt, digest = stored_hash.split("$", maxsplit=3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iterations),
    )
    return hmac.compare_digest(_urlsafe_b64encode(candidate), digest)


def _sign_payload(payload: dict[str, Any], secret: str) -> str:
    body = _urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = hmac.new(
        secret.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{body}.{_urlsafe_b64encode(signature)}"


def _verify_signed_payload(token: str, secret: str) -> dict[str, Any]:
    try:
        encoded_body, encoded_signature = token.split(".", maxsplit=1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token.") from exc

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        encoded_body.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(
        _urlsafe_b64encode(expected_signature),
        encoded_signature,
    ):
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

    try:
        payload = json.loads(_urlsafe_b64decode(encoded_body).decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token.") from exc

    expires_at = payload.get("exp")
    if expires_at is not None and int(expires_at) < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=401, detail="Authentication token expired.")
    return payload


def create_access_token(*, user_id: str, email: str, secret: str, ttl_minutes: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=max(ttl_minutes, 5))
    return _sign_payload(
        {
            "kind": "access",
            "sub": user_id,
            "email": email,
            "exp": int(expires_at.timestamp()),
        },
        secret,
    )


def create_oauth_state_token(
    *,
    payload: dict[str, Any],
    secret: str,
    ttl_minutes: int = 10,
) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=max(ttl_minutes, 1))
    signed_payload = {
        **payload,
        "kind": "oauth_state",
        "exp": int(expires_at.timestamp()),
    }
    return _sign_payload(signed_payload, secret)


def decode_oauth_state_token(token: str, secret: str) -> dict[str, Any]:
    payload = _verify_signed_payload(token, secret)
    if payload.get("kind") != "oauth_state":
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")
    return payload


def decode_access_token(token: str, secret: str) -> dict[str, Any]:
    payload = _verify_signed_payload(token, secret)
    if payload.get("kind") != "access":
        raise HTTPException(status_code=401, detail="Invalid authentication token.")
    return payload


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    token = _auth_header_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    settings = get_settings()
    payload = decode_access_token(token, settings.auth_token_secret)
    user = await UserRepository(session).get(payload["sub"])
    if user is None:
        raise HTTPException(status_code=401, detail="User account no longer exists.")

    request.state.current_user = user
    return user


async def get_optional_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    token = _auth_header_token(request)
    if not token:
        return None

    try:
        settings = get_settings()
        payload = decode_access_token(token, settings.auth_token_secret)
    except HTTPException:
        return None

    user = await UserRepository(session).get(payload["sub"])
    request.state.current_user = user
    return user
