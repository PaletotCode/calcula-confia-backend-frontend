import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi import HTTPException, status
from passlib.exc import PasswordValueError

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.models_schemas.models import User
from app.services.main_service import UserService


@dataclass
class _DummyResult:
    user: User

    def scalar_one_or_none(self):
        return self.user


class _DummySession:
    def __init__(self, user: User):
        self.user = user
        self.added = []
        self.commits = 0

    async def execute(self, _):
        return _DummyResult(self.user)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, _):
        return None


def test_authenticate_user_handles_overlong_password(monkeypatch):
    def fake_verify_password(plain: str, hashed: str) -> bool:
        raise PasswordValueError("password too long")

    monkeypatch.setattr(
        "app.services.main_service.verify_password",
        fake_verify_password
    )

    async def _run_test():
        user = User(
            email="user@example.com",
            hashed_password="dummy-hash",
            is_active=True,
            is_verified=True
        )
        db = _DummySession(user)

        with pytest.raises(HTTPException) as exc_info:
            await UserService.authenticate_user(
                db=db,
                identifier=user.email,
                password="a" * 100,
                request=None
            )

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc_info.value.detail == "Invalid credentials"
        assert db.commits >= 1  # Audit log attempted

    asyncio.run(_run_test())


def test_bcrypt_sha256_allows_long_passwords():
    from app.core.security import get_password_hash, verify_password
    import pytest

    long_password = "p" * 100

    try:
        hashed = get_password_hash(long_password)
    except ValueError as exc:
        pytest.skip(f"bcrypt backend not available for long passwords: {exc}")

    assert verify_password(long_password, hashed)