import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from core.auth import create_access_token
from core.database import db_manager
from models.staff_users import StaffUser
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_ITERATIONS = 260_000
_ALGO = "sha256"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(_ALGO, password.encode(), salt.encode(), _ITERATIONS)
    return f"pbkdf2:{_ALGO}:{_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _algo_part, salt, dk_hex = password_hash.split("$")
        dk = hashlib.pbkdf2_hmac(_ALGO, password.encode(), salt.encode(), _ITERATIONS)
        return secrets.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


class StaffAuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> Optional[StaffUser]:
        result = await self.db.execute(select(StaffUser).where(StaffUser.email == email.lower()))
        return result.scalar_one_or_none()

    async def login(self, email: str, password: str) -> Optional[Tuple[str, StaffUser]]:
        user = await self.get_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        expires = 60 * 24 * 7  # 7 days
        token = create_access_token(
            {"sub": user.id, "email": user.email, "name": user.name or "", "role": user.role},
            expires_minutes=expires,
        )
        return token, user

    async def create(self, email: str, password: str, name: str, role: str = "staff") -> StaffUser:
        user = StaffUser(
            id=secrets.token_urlsafe(16),
            email=email.lower(),
            password_hash=hash_password(password),
            name=name,
            role=role,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user


async def initialize_staff_users():
    """Seed default staff accounts on first startup."""
    await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        service = StaffAuthService(db)

        seeds = [
            ("admin@schoolhouselane.co", "Admin2026!", "Admin", "admin"),
            ("shalale@schoolhouselane.co", "Admin2026!", "Shalale", "admin"),
        ]
        for email, password, name, role in seeds:
            if not await service.get_by_email(email):
                await service.create(email, password, name, role)
                logger.info("Seeded staff user: %s", email)
