import logging
from typing import Optional

from core.auth import decode_access_token, AccessTokenError
from core.database import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from services.client_auth import ClientAuthService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth/client", tags=["client-auth"])
logger = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=False)


class ClientLoginRequest(BaseModel):
    email: str
    password: str


class ClientLoginResponse(BaseModel):
    token: str
    email: str
    company_name: Optional[str] = None


class ClientMeResponse(BaseModel):
    id: str
    email: str
    company_name: Optional[str] = None
    role: str = "client"


def _get_client_from_token(credentials: HTTPAuthorizationCredentials) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except AccessTokenError as e:
        raise HTTPException(status_code=401, detail=str(e))
    if payload.get("role") != "client":
        raise HTTPException(status_code=403, detail="Client access only")
    return payload


@router.post("/login", response_model=ClientLoginResponse)
async def client_login(payload: ClientLoginRequest, db: AsyncSession = Depends(get_db)):
    service = ClientAuthService(db)
    result = await service.login(payload.email, payload.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token, client = result
    return ClientLoginResponse(token=token, email=client.email, company_name=client.company_name)


@router.get("/me", response_model=ClientMeResponse)
async def client_me(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    payload = _get_client_from_token(credentials)
    return ClientMeResponse(
        id=payload["sub"],
        email=payload["email"],
        company_name=payload.get("company"),
    )
