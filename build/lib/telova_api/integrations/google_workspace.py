from __future__ import annotations

import asyncio
import json
import logging

from telova_api.config import Settings
from telova_api.secrets import SecretResolver


logger = logging.getLogger(__name__)


class GoogleWorkspaceConfigurationError(RuntimeError):
    """Raised when Google Workspace integrations are requested but not configured."""


class GoogleWorkspaceClientFactory:
    def __init__(self, settings: Settings, secret_resolver: SecretResolver) -> None:
        self.settings = settings
        self.secret_resolver = secret_resolver

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
        return await asyncio.to_thread(
            self._execute_sync,
            user_id,
            service_name,
            version,
            scopes,
            operation,
        )

    def _execute_sync(
        self,
        user_id: str | None,
        service_name: str,
        version: str,
        scopes: list[str],
        operation,
    ):
        credentials = self._build_credentials(scopes, user_id=user_id)
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

    def _build_credentials(self, scopes: list[str], user_id: str | None = None):
        mode = self.auth_mode()
        if mode == "disabled":
            raise GoogleWorkspaceConfigurationError(
                "GOOGLE_WORKSPACE_AUTH_MODE is disabled."
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
