import logging
from typing import Optional

from core.auth import decode_access_token, AccessTokenError
from core.database import get_db
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from services.staff_auth import StaffAuthService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth/staff", tags=["staff-auth"])
logger = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=False)


class StaffLoginRequest(BaseModel):
    email: str
    password: str


class StaffLoginResponse(BaseModel):
    token: str
    email: str
    name: Optional[str] = None
    role: str


class StaffMeResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str


@router.post("/login", response_model=StaffLoginResponse)
async def staff_login(payload: StaffLoginRequest, db: AsyncSession = Depends(get_db)):
    service = StaffAuthService(db)
    result = await service.login(payload.email, payload.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token, user = result
    return StaffLoginResponse(token=token, email=user.email, name=user.name, role=user.role)


@router.get("/me", response_model=StaffMeResponse)
async def staff_me(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except AccessTokenError as e:
        raise HTTPException(status_code=401, detail=str(e))
    role = payload.get("role", "")
    if role not in ("admin", "staff"):
        raise HTTPException(status_code=403, detail="Staff access only")
    return StaffMeResponse(
        id=payload["sub"],
        email=payload.get("email", ""),
        name=payload.get("name"),
        role=role,
    )
