from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Iterable
from zoneinfo import ZoneInfo


UTC = timezone.utc


@dataclass(frozen=True)
class BusyWindow:
    start_at: datetime
    end_at: datetime


class TimeboxScheduler:
    def __init__(self, timezone_name: str) -> None:
        self.zone = ZoneInfo(timezone_name)
        self.work_windows = (
            (time(hour=9, minute=30), time(hour=12, minute=30)),
            (time(hour=13, minute=30), time(hour=18, minute=0)),
        )

    def now(self) -> datetime:
        return datetime.now(UTC)

    def ensure_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def to_local(self, value: datetime) -> datetime:
        return self.ensure_utc(value).astimezone(self.zone)

    def to_utc(self, value: datetime) -> datetime:
        return self.ensure_utc(value)

    def normalize_start(self, value: datetime) -> datetime:
        local = self.to_local(value)
        if local.weekday() >= 5:
            local = self._next_workday(local)
        while True:
            for start_time, end_time in self.work_windows:
                window_start = local.replace(
                    hour=start_time.hour,
                    minute=start_time.minute,
                    second=0,
                    microsecond=0,
                )
                window_end = local.replace(
                    hour=end_time.hour,
                    minute=end_time.minute,
                    second=0,
                    microsecond=0,
                )
                if local <= window_start:
                    return window_start.astimezone(UTC)
                if window_start <= local < window_end:
                    return local.astimezone(UTC)
            local = self._next_workday(local)

    def _next_workday(self, value: datetime) -> datetime:
        local = value.astimezone(self.zone)
        next_day = (local + timedelta(days=1)).replace(
            hour=self.work_windows[0][0].hour,
            minute=self.work_windows[0][0].minute,
            second=0,
            microsecond=0,
        )
        while next_day.weekday() >= 5:
            next_day += timedelta(days=1)
        return next_day

    def _window_end(self, value: datetime) -> datetime:
        local = self.to_local(value)
        for start_time, end_time in self.work_windows:
            window_start = local.replace(
                hour=start_time.hour,
                minute=start_time.minute,
                second=0,
                microsecond=0,
            )
            candidate = local.replace(
                hour=end_time.hour,
                minute=end_time.minute,
                second=0,
                microsecond=0,
            )
            if window_start <= local <= candidate:
                return candidate.astimezone(UTC)
        return self._next_workday(local).astimezone(UTC)

    def _advance_cursor(self, value: datetime) -> datetime:
        local = self.to_local(value)
        for index, (start_time, end_time) in enumerate(self.work_windows):
            window_start = local.replace(
                hour=start_time.hour,
                minute=start_time.minute,
                second=0,
                microsecond=0,
            )
            window_end = local.replace(
                hour=end_time.hour,
                minute=end_time.minute,
                second=0,
                microsecond=0,
            )
            if local < window_start:
                return window_start.astimezone(UTC)
            if window_start <= local < window_end:
                if index + 1 < len(self.work_windows):
                    next_start_time, _ = self.work_windows[index + 1]
                    next_start = local.replace(
                        hour=next_start_time.hour,
                        minute=next_start_time.minute,
                        second=0,
                        microsecond=0,
                    )
                    return next_start.astimezone(UTC)
                return self._next_workday(local).astimezone(UTC)
        return self._next_workday(local).astimezone(UTC)

    def find_next_slot(
        self,
        duration_minutes: int,
        busy_windows: Iterable[BusyWindow],
        after: datetime,
        horizon_days: int = 45,
        exclude_event_id: str | None = None,
    ) -> tuple[datetime, datetime] | None:
        del exclude_event_id

        duration = timedelta(minutes=max(duration_minutes, 30))
        cursor = self.normalize_start(after)
        limit = cursor + timedelta(days=horizon_days)
        ordered = sorted(
            [BusyWindow(self.ensure_utc(window.start_at), self.ensure_utc(window.end_at)) for window in busy_windows],
            key=lambda window: window.start_at,
        )

        while cursor < limit:
            cursor = self.normalize_start(cursor)
            slot_end = cursor + duration
            if slot_end > self._window_end(cursor):
                cursor = self._advance_cursor(cursor)
                continue

            overlapping = next(
                (
                    window
                    for window in ordered
                    if cursor < window.end_at and slot_end > window.start_at
                ),
                None,
            )
            if overlapping is None:
                return cursor, slot_end
            cursor = overlapping.end_at + timedelta(minutes=15)

        return None
