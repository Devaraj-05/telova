from __future__ import annotations

import asyncio
import json
import logging

from telova_api.config import Settings
from telova_api.repositories.google_connections import (
    GoogleWorkspaceConnectionRepository,
)
from telova_api.secrets import SecretResolver


logger = logging.getLogger(__name__)


class GoogleWorkspaceConfigurationError(RuntimeError):
    """Raised when Google Workspace integrations are requested but not configured."""


class GoogleWorkspaceClientFactory:
    def __init__(
        self,
        settings: Settings,
        secret_resolver: SecretResolver,
        *,
        connection_repo: GoogleWorkspaceConnectionRepository | None = None,
    ) -> None:
        self.settings = settings
        self.secret_resolver = secret_resolver
        self.connection_repo = connection_repo

    def is_enabled(self) -> bool:
        return self.settings.is_google_backend

    def auth_mode(self) -> str:
        return self.settings.google_workspace_auth_mode.strip().lower()

    def is_configured(self) -> bool:
        mode = self.auth_mode()
        if mode == "disabled":
            return False
        if mode == "authorized_user":
            return bool(
                self.secret_resolver.resolve_text(
                    inline_value=self.settings.google_workspace_authorized_user_json,
                    file_path=self.settings.google_workspace_authorized_user_json_file,
                    secret_name=self.settings.google_workspace_authorized_user_secret,
                    label="Google authorized user credentials",
                )
            )
        if mode == "service_account":
            return bool(
                self.secret_resolver.resolve_text(
                    inline_value=self.settings.google_workspace_service_account_json,
                    file_path=self.settings.google_workspace_service_account_json_file,
                    secret_name=self.settings.google_workspace_service_account_secret,
                    label="Google service account credentials",
                )
            )
        return mode == "adc"

    def resolve_subject(self, user_id: str | None = None) -> str | None:
        if user_id and "@" in user_id:
            return user_id
        return self.settings.google_workspace_subject

    async def is_ready(
        self,
        user_id: str | None = None,
        *,
        scopes: list[str] | None = None,
    ) -> bool:
        if not self.is_enabled():
            return False

        if user_id and self.connection_repo is not None:
            connection = await self.connection_repo.get_by_user_id(user_id)
            if connection is not None:
                if not scopes:
                    return True
                granted_scopes = set(connection.granted_scopes or [])
                return all(scope in granted_scopes for scope in scopes)

        return self.is_configured()

    async def execute(
        self,
        *,
        user_id: str | None,
        service_name: str,
        version: str,
        scopes: list[str],
        operation,
    ):
        if not self.is_enabled():
            raise GoogleWorkspaceConfigurationError(
                "Google Workspace integrations are not enabled."
            )
        credentials = await self._build_credentials_async(scopes, user_id=user_id)
        return await asyncio.to_thread(
            self._execute_sync,
            credentials,
            service_name,
            version,
            operation,
        )

    def _execute_sync(
        self,
        credentials,
        service_name: str,
        version: str,
        operation,
    ):
        try:
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise GoogleWorkspaceConfigurationError(
                "Google Workspace integrations require `google-api-python-client`, "
                "`google-auth-httplib2`, and `google-auth-oauthlib`."
            ) from exc

        service = build(
            service_name,
            version,
            credentials=credentials,
            cache_discovery=False,
        )
        return operation(service)

    async def _build_credentials_async(
        self,
        scopes: list[str],
        *,
        user_id: str | None = None,
    ):
        if user_id and self.connection_repo is not None:
            connection = await self.connection_repo.get_by_user_id(user_id)
            if connection is not None:
                granted_scopes = set(connection.granted_scopes or [])
                missing_scopes = [
                    scope for scope in scopes if scope not in granted_scopes
                ]
                if missing_scopes:
                    raise GoogleWorkspaceConfigurationError(
                        "The connected Google account is missing required scopes: "
                        f"{', '.join(missing_scopes)}."
                    )
                try:
                    from google.oauth2.credentials import Credentials
                except ImportError as exc:
                    raise GoogleWorkspaceConfigurationError(
                        "Authorized user mode requires `google-auth`."
                    ) from exc
                return Credentials.from_authorized_user_info(
                    dict(connection.credentials_json or {}),
                    scopes=scopes,
                )

        return self._build_credentials(scopes, user_id=user_id)

    def _build_credentials(self, scopes: list[str], user_id: str | None = None):
        mode = self.auth_mode()
        if mode == "disabled":
            raise GoogleWorkspaceConfigurationError(
                "Google Workspace credentials are not available for this user."
            )
        if mode == "authorized_user":
            payload = self.secret_resolver.resolve_text(
                inline_value=self.settings.google_workspace_authorized_user_json,
                file_path=self.settings.google_workspace_authorized_user_json_file,
                secret_name=self.settings.google_workspace_authorized_user_secret,
                required=True,
                label="Google authorized user credentials",
            )
            try:
                from google.oauth2.credentials import Credentials
            except ImportError as exc:
                raise GoogleWorkspaceConfigurationError(
                    "Authorized user mode requires `google-auth`."
                ) from exc
            return Credentials.from_authorized_user_info(
                json.loads(payload),
                scopes=scopes,
            )

        if mode == "service_account":
            payload = self.secret_resolver.resolve_text(
                inline_value=self.settings.google_workspace_service_account_json,
                file_path=self.settings.google_workspace_service_account_json_file,
                secret_name=self.settings.google_workspace_service_account_secret,
                required=True,
                label="Google service account credentials",
            )
            subject = self.resolve_subject(user_id)
            try:
                from google.oauth2 import service_account
            except ImportError as exc:
                raise GoogleWorkspaceConfigurationError(
                    "Service account mode requires `google-auth`."
                ) from exc
            credentials = service_account.Credentials.from_service_account_info(
                json.loads(payload),
                scopes=scopes,
            )
            if subject:
                credentials = credentials.with_subject(subject)
            return credentials

        if mode == "adc":
            try:
                import google.auth
            except ImportError as exc:
                raise GoogleWorkspaceConfigurationError(
                    "ADC mode requires `google-auth`."
                ) from exc
            credentials, _ = google.auth.default(scopes=scopes)
            return credentials

        raise GoogleWorkspaceConfigurationError(
            f"Unsupported Google Workspace auth mode: {mode}"
        )

    def describe_auth(self) -> str:
        mode = self.auth_mode()
        if mode == "disabled":
            if self.connection_repo is not None:
                return "Using per-user OAuth connections for Workspace APIs."
            return "Google Workspace auth is disabled."
        if mode == "authorized_user":
            return "Using OAuth authorized-user credentials for Workspace APIs."
        if mode == "service_account":
            subject = self.settings.google_workspace_subject or "per-user subject"
            return (
                "Using service account credentials for Workspace APIs with "
                f"subject {subject}."
            )
        if mode == "adc":
            return "Using application default credentials for Google API calls."
        return f"Using {mode} mode for Workspace APIs."
