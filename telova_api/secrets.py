from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from telova_api.config import Settings


class SecretResolutionError(RuntimeError):
    """Raised when a required secret or credential payload cannot be resolved."""


@lru_cache(maxsize=1)
def _secret_manager_client():
    try:
        from google.cloud import secretmanager
    except ImportError as exc:
        raise RuntimeError(
            "Secret Manager support requires `google-cloud-secret-manager`. "
            "Install the optional GCP dependencies before enabling runtime "
            "secret resolution."
        ) from exc
    return secretmanager.SecretManagerServiceClient()


class SecretResolver:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def resolve_text(
        self,
        *,
        inline_value: str | None = None,
        file_path: str | None = None,
        secret_name: str | None = None,
        required: bool = False,
        label: str = "secret",
        version: str = "latest",
    ) -> str | None:
        if inline_value:
            return inline_value.strip()

        missing_file_error: str | None = None
        if file_path:
            path = Path(file_path)
            if path.exists():
                return path.read_text(encoding="utf-8").strip()
            missing_file_error = (
                f"The configured {label} file was not found: {path}"
            )

        if secret_name:
            if not self.settings.use_secret_manager:
                if required and not missing_file_error:
                    raise SecretResolutionError(
                        f"{label} is configured via Secret Manager, but "
                        "USE_SECRET_MANAGER is disabled."
                    )
            else:
                return self._access_secret(secret_name, version=version)

        if missing_file_error:
            if required:
                raise SecretResolutionError(missing_file_error)
            return None

        if required:
            raise SecretResolutionError(
                f"No value was provided for required {label}."
            )
        return None

    @lru_cache(maxsize=64)
    def _access_secret(self, secret_name: str, version: str = "latest") -> str:
        if secret_name.startswith("projects/"):
            resource_name = secret_name
        else:
            if not self.settings.gcp_project_id:
                raise SecretResolutionError(
                    "GCP_PROJECT_ID is required when using short Secret Manager "
                    "secret names."
                )
            resource_name = (
                f"projects/{self.settings.gcp_project_id}/secrets/"
                f"{secret_name}/versions/{version}"
            )

        response = _secret_manager_client().access_secret_version(
            request={"name": resource_name}
        )
        return response.payload.data.decode("utf-8").strip()
