from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from fastapi import HTTPException
from starlette.requests import Request

from telova_api.auth import (
    create_access_token,
    create_oauth_state_token,
    hash_password,
    verify_password,
    decode_oauth_state_token,
)
from telova_api.config import Settings
from telova_api.integrations.calendar import CALENDAR_SCOPES
from telova_api.integrations.notes import KEEP_SCOPES
from telova_api.integrations.tasks import TASKS_SCOPES
from telova_api.models import GoogleWorkspaceConnection, User
from telova_api.repositories.google_connections import (
    GoogleWorkspaceConnectionRepository,
)
from telova_api.repositories.users import UserRepository
from telova_api.secrets import SecretResolver


IDENTITY_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]
USER_INFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class UserAuthService:
    def __init__(
        self,
        *,
        settings: Settings,
        secret_resolver: SecretResolver,
        user_repo: UserRepository,
        connection_repo: GoogleWorkspaceConnectionRepository,
    ) -> None:
        self.settings = settings
        self.secret_resolver = secret_resolver
        self.user_repo = user_repo
        self.connection_repo = connection_repo

    async def signup(
        self,
        *,
        email: str,
        password: str,
        display_name: str | None = None,
    ) -> tuple[User, str]:
        normalized_email = email.lower().strip()
        existing = await self.user_repo.get_by_email(normalized_email)
        if existing is not None:
            raise HTTPException(status_code=409, detail="Email is already registered.")

        user = await self.user_repo.create(
            User(
                email=normalized_email,
                display_name=(display_name or normalized_email.split("@", 1)[0]).strip(),
                password_hash=hash_password(password),
            )
        )
        return user, self._issue_token(user)

    async def login(self, *, email: str, password: str) -> tuple[User, str]:
        normalized_email = email.lower().strip()
        user = await self.user_repo.get_by_email(normalized_email)
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return user, self._issue_token(user)

    async def create_google_authorization_url(
        self,
        *,
        request: Request,
        mode: str,
        redirect_uri: str,
        user: User | None,
        include_keep: bool,
    ) -> str:
        normalized_mode = mode.strip().lower()
        if normalized_mode not in {"login", "connect"}:
            raise HTTPException(status_code=400, detail="Unsupported Google auth mode.")
        if normalized_mode == "connect" and user is None:
            raise HTTPException(status_code=401, detail="Authentication required.")
        if not self._is_allowed_redirect_uri(request, redirect_uri):
            raise HTTPException(status_code=400, detail="Invalid frontend redirect URI.")

        scopes = self._build_scopes(
            mode=normalized_mode,
            include_keep=include_keep,
        )

        client_config = self._resolve_google_oauth_client_config()
        # Extract the exact redirect URI registered in the JSON to avoid any proxy/scheme mismatch issues
        try:
            callback_uri = client_config["web"]["redirect_uris"][0]
        except (KeyError, IndexError) as exc:
            raise HTTPException(
                status_code=500, detail="Missing redirect_uris in Google OAuth client config."
            ) from exc

        try:
            from google_auth_oauthlib.flow import Flow
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Google OAuth flow requires google-auth-oauthlib. "
                    "Install the optional GCP dependencies."
                ),
            ) from exc

        # 1. Create flow and generate auth URL to obtain a PKCE code_verifier.
        flow = Flow.from_client_config(client_config, scopes=scopes)
        flow.redirect_uri = callback_uri
        authorization_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )

        # 2. Build state token that includes the PKCE code_verifier so we can
        #    restore it when the callback arrives on a new Flow instance.
        state_token = create_oauth_state_token(
            payload={
                "mode": normalized_mode,
                "frontend_redirect_uri": redirect_uri,
                "user_id": user.id if user else None,
                "scopes": scopes,
                "code_verifier": getattr(flow, "code_verifier", None),
            },
            secret=self.settings.auth_token_secret,
        )

        # 3. Replace the auto-generated state param in the URL with our signed token.
        parsed = urlparse(authorization_url)
        params = parse_qs(parsed.query, keep_blank_values=True)
        params["state"] = [state_token]
        authorization_url = urlunparse(
            parsed._replace(query=urlencode(params, doseq=True))
        )
        return authorization_url

    async def complete_google_authorization(
        self,
        *,
        request: Request,
        state_token: str,
    ) -> str:
        state = decode_oauth_state_token(state_token, self.settings.auth_token_secret)
        scopes = list(state.get("scopes", []))
        client_config = self._resolve_google_oauth_client_config()

        try:
            from google_auth_oauthlib.flow import Flow
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Google OAuth flow requires google-auth-oauthlib. "
                    "Install the optional GCP dependencies."
                ),
            ) from exc

        flow = Flow.from_client_config(client_config, scopes=scopes, state=state_token)
        try:
            callback_uri = client_config["web"]["redirect_uris"][0]
        except (KeyError, IndexError) as exc:
            raise HTTPException(
                status_code=500, detail="Missing redirect_uris in Google OAuth client config."
            ) from exc
        flow.redirect_uri = callback_uri

        # Restore the PKCE code_verifier that was stored in the state token
        # during create_google_authorization_url, so fetch_token can present
        # the verifier to Google and complete the exchange.
        code_verifier = state.get("code_verifier")
        if code_verifier:
            flow.code_verifier = code_verifier

        await asyncio.to_thread(
            flow.fetch_token,
            authorization_response=str(request.url),
        )
        credentials = flow.credentials
        profile = await self._fetch_google_profile(credentials.token)

        mode = state["mode"]
        redirect_uri = state["frontend_redirect_uri"]
        if mode == "login":
            user = await self._login_or_create_google_user(profile)
            app_token = self._issue_token(user)
            return self._build_frontend_redirect(
                redirect_uri,
                {
                    "flow": "login",
                    "status": "success",
                    "app_token": app_token,
                },
            )

        user_id = state.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="Missing user context for Google connect.")
        user = await self.user_repo.get(user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found.")

        await self._store_google_connection(
            user=user,
            profile=profile,
            credentials_json=json.loads(credentials.to_json()),
            scopes=list(credentials.scopes or scopes),
        )
        return self._build_frontend_redirect(
            redirect_uri,
            {
                "flow": "connect",
                "status": "success",
            },
        )

    async def google_connection_status(self, *, user: User) -> dict[str, Any]:
        connection = await self.connection_repo.get_by_user_id(user.id)
        if connection is None:
            return {
                "status": "disconnected",
                "provider_email": None,
                "calendar_connected": False,
                "tasks_connected": False,
                "keep_connected": False,
                "scopes": [],
                "connected_at": None,
                "detail": (
                    "Connect Google Calendar, Google Tasks, and Google Keep so "
                    "Telova can sync your approved plans."
                ),
            }

        granted_scopes = set(connection.granted_scopes or [])
        keep_requested = (
            self.settings.google_keep_enabled
            or KEEP_SCOPES[0] in granted_scopes
        )
        calendar_connected = CALENDAR_SCOPES[0] in granted_scopes
        tasks_connected = TASKS_SCOPES[0] in granted_scopes
        keep_connected = KEEP_SCOPES[0] in granted_scopes if keep_requested else False
        fully_connected = calendar_connected and tasks_connected and (
            keep_connected or not keep_requested
        )
        detail = "Google tools are connected and ready for sync."
        if keep_requested and not keep_connected:
            detail = (
                "Calendar and Tasks are connected. Google Keep is still waiting "
                "for a granted scope or supported account access."
            )
        elif not fully_connected:
            detail = (
                "Google account is linked, but one or more tool scopes are still missing."
            )

        return {
            "status": "connected" if fully_connected else "partial",
            "provider_email": connection.provider_email,
            "calendar_connected": calendar_connected,
            "tasks_connected": tasks_connected,
            "keep_connected": keep_connected,
            "scopes": list(connection.granted_scopes or []),
            "connected_at": connection.connected_at,
            "detail": detail,
        }

    async def disconnect_google_connection(self, *, user: User) -> None:
        connection = await self.connection_repo.get_by_user_id(user.id)
        if connection is not None:
            await self.connection_repo.delete(connection)

    def _issue_token(self, user: User) -> str:
        return create_access_token(
            user_id=user.id,
            email=user.email,
            secret=self.settings.auth_token_secret,
            ttl_minutes=self.settings.auth_token_ttl_minutes,
        )

    def _build_scopes(self, *, mode: str, include_keep: bool) -> list[str]:
        if mode == "login":
            return IDENTITY_SCOPES

        scopes = [*IDENTITY_SCOPES, *CALENDAR_SCOPES, *TASKS_SCOPES]
        return scopes

    def build_google_error_redirect(
        self,
        *,
        state_token: str | None,
        error: str,
        error_description: str | None = None,
    ) -> str | None:
        if not state_token:
            return None
        try:
            state = decode_oauth_state_token(
                state_token,
                self.settings.auth_token_secret,
            )
        except HTTPException:
            return None

        payload = {
            "flow": str(state.get("mode") or "connect"),
            "status": "error",
            "error": error,
        }
        if error_description:
            payload["message"] = error_description
        return self._build_frontend_redirect(
            state["frontend_redirect_uri"],
            payload,
        )

    def _resolve_google_oauth_client_config(self) -> dict[str, Any]:
        payload = self.secret_resolver.resolve_text(
            inline_value=self.settings.google_oauth_client_json,
            file_path=self.settings.google_oauth_client_json_file,
            secret_name=self.settings.google_oauth_client_json_secret,
            required=True,
            label="Google OAuth client credentials",
        )
        try:
            return json.loads(payload)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="Google OAuth client credentials are not valid JSON.",
            ) from exc

    async def _fetch_google_profile(self, access_token: str) -> dict[str, Any]:
        try:
            import httpx
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail="Google OAuth profile fetch requires httpx.",
            ) from exc
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                USER_INFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def _login_or_create_google_user(self, profile: dict[str, Any]) -> User:
        email = (profile.get("email") or "").lower().strip()
        subject = profile.get("sub")
        if not email or not subject:
            raise HTTPException(
                status_code=400,
                detail="Google account did not return a usable identity.",
            )

        user = await self.user_repo.get_by_email_or_google_subject(
            email=email,
            google_subject=subject,
        )
        if user is None:
            return await self.user_repo.create(
                User(
                    email=email,
                    display_name=(profile.get("name") or email.split("@", 1)[0]).strip(),
                    password_hash=None,
                    google_subject=subject,
                )
            )

        user.email = email
        user.google_subject = subject
        if profile.get("name"):
            user.display_name = str(profile["name"]).strip()
        return await self.user_repo.save(user)

    async def _store_google_connection(
        self,
        *,
        user: User,
        profile: dict[str, Any],
        credentials_json: dict[str, Any],
        scopes: list[str],
    ) -> GoogleWorkspaceConnection:
        if profile.get("sub") and not user.google_subject:
            user.google_subject = str(profile["sub"])
        if profile.get("name"):
            user.display_name = str(profile["name"]).strip()
        await self.user_repo.save(user)

        existing = await self.connection_repo.get_by_user_id(user.id)
        if existing is None:
            connection = GoogleWorkspaceConnection(
                user_id=user.id,
                provider_email=(profile.get("email") or user.email).lower().strip(),
                provider_subject=str(profile.get("sub") or user.google_subject or ""),
                granted_scopes=sorted(set(scopes)),
                credentials_json=credentials_json,
            )
            return await self.connection_repo.create(connection)

        existing.provider_email = (profile.get("email") or user.email).lower().strip()
        existing.provider_subject = str(profile.get("sub") or existing.provider_subject)
        existing.granted_scopes = sorted(set(scopes))
        existing.credentials_json = credentials_json
        existing.updated_at = datetime.now(timezone.utc)
        return await self.connection_repo.save(existing)

    def _is_allowed_redirect_uri(self, request: Request, redirect_uri: str) -> bool:
        parsed = urlparse(redirect_uri)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return False

        candidate_origin = f"{parsed.scheme}://{parsed.netloc}"
        allowed_origins = {origin.rstrip("/") for origin in self.settings.cors_allow_origins}
        if self.settings.frontend_app_url:
            allowed_origins.add(self.settings.frontend_app_url.rstrip("/"))
        allowed_origins.add(f"{request.url.scheme}://{request.url.netloc}")
        
        # Always allow the origin that matches our strict google-web-client.json configuration
        try:
            config = self._resolve_google_oauth_client_config()
            strict_uri = config["web"]["redirect_uris"][0]
            strict_parsed = urlparse(strict_uri)
            allowed_origins.add(f"{strict_parsed.scheme}://{strict_parsed.netloc}")
        except Exception:
            pass
            
        return candidate_origin in allowed_origins

    def _build_frontend_redirect(
        self,
        redirect_uri: str,
        payload: dict[str, str],
    ) -> str:
        return f"{redirect_uri}#{urlencode(payload)}"
