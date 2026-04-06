from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IntegrationStatus:
    name: str
    kind: str
    status: str
    detail: str
    backend: str
