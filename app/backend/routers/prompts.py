import json
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.prompts import PromptsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/prompts", tags=["prompts"])


class PromptData(BaseModel):
    title: str
    tool: str
    category: str
    text: str


class PromptUpdateData(BaseModel):
    title: Optional[str] = None
    tool: Optional[str] = None
    category: Optional[str] = None
    text: Optional[str] = None


class PromptResponse(BaseModel):
    id: int
    user_id: str
    title: str
    tool: str
    category: str
    text: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PromptListResponse(BaseModel):
    items: List[PromptResponse]
    total: int
    skip: int
    limit: int


@router.get("", response_model=PromptListResponse)
async def list_prompts(
    query: str = Query(None),
    sort: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=2000),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = PromptsService(db)
    try:
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON")
        return await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing prompts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}", response_model=PromptResponse)
async def get_prompt(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = PromptsService(db)
    result = await service.get_by_id(id, user_id=str(current_user.id))
    if not result:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return result


@router.post("", response_model=PromptResponse, status_code=201)
async def create_prompt(
    data: PromptData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = PromptsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create prompt")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating prompt: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{id}", response_model=PromptResponse)
async def update_prompt(
    id: int,
    data: PromptUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = PromptsService(db)
    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await service.update(id, update_dict, user_id=str(current_user.id))
    if not result:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return result


@router.delete("/{id}")
async def delete_prompt(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = PromptsService(db)
    success = await service.delete(id, user_id=str(current_user.id))
    if not success:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"message": "Prompt deleted", "id": id}
