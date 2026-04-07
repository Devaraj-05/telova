from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from telova_api.models import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def get(self, user_id: str) -> User | None:
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email.lower().strip())
        )
        return result.scalar_one_or_none()

    async def get_by_google_subject(self, subject: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.google_subject == subject)
        )
        return result.scalar_one_or_none()

    async def get_by_email_or_google_subject(
        self,
        *,
        email: str,
        google_subject: str | None = None,
    ) -> User | None:
        clauses = [User.email == email.lower().strip()]
        if google_subject:
            clauses.append(User.google_subject == google_subject)
        result = await self.session.execute(select(User).where(or_(*clauses)))
        return result.scalar_one_or_none()

    async def save(self, user: User) -> User:
        await self.session.flush()
        await self.session.refresh(user)
        return user
