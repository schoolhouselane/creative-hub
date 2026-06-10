import hashlib
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from core.auth import create_access_token
from core.database import db_manager
from models.client_users import ClientUser
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_ITERATIONS = 260_000
_HASH_ALGO = "sha256"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(_HASH_ALGO, password.encode(), salt.encode(), _ITERATIONS)
    return f"pbkdf2:{_HASH_ALGO}:{_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _algo_part, salt, dk_hex = password_hash.split("$")
        dk = hashlib.pbkdf2_hmac(_HASH_ALGO, password.encode(), salt.encode(), _ITERATIONS)
        return secrets.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


class ClientAuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_client_by_email(self, email: str) -> Optional[ClientUser]:
        result = await self.db.execute(select(ClientUser).where(ClientUser.email == email.lower()))
        return result.scalar_one_or_none()

    async def login(self, email: str, password: str) -> Optional[Tuple[str, ClientUser]]:
        client = await self.get_client_by_email(email)
        if not client or not client.is_active:
            return None
        if not verify_password(password, client.password_hash):
            return None

        client.last_login = datetime.now(timezone.utc)
        await self.db.commit()

        expires_minutes = 60 * 24 * 7  # 7 days for clients
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
        token = create_access_token(
            {
                "sub": client.id,
                "email": client.email,
                "company": client.company_name or "",
                "role": "client",
            },
            expires_minutes=expires_minutes,
        )
        return token, client

    async def create_client(self, email: str, password: str, company_name: str) -> ClientUser:
        client = ClientUser(
            id=secrets.token_urlsafe(16),
            email=email.lower(),
            password_hash=hash_password(password),
            company_name=company_name,
        )
        self.db.add(client)
        await self.db.commit()
        await self.db.refresh(client)
        return client


async def initialize_shelby_client():
    """Seed Shelby Cycles client account on startup."""
    await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        service = ClientAuthService(db)
        existing = await service.get_client_by_email("shelby@shelbycycles.com")
        if not existing:
            await service.create_client(
                email="shelby@shelbycycles.com",
                password="password",
                company_name="Shelby Cycles",
            )
            logger.info("Shelby Cycles client account created")
        else:
            logger.info("Shelby Cycles client account already exists")
