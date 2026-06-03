import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.briefs import BriefsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/briefs", tags=["briefs"])


# ---------- Pydantic Schemas ----------
class BriefsData(BaseModel):
    """Entity data schema (for create/update)"""
    brief_type: str
    title: str
    status: str
    brand_name: str = None
    project_description: str = None
    target_audience: str = None
    tone_style: str = None
    dimensions: str = None
    platform: str = None
    key_message: str = None
    additional_notes: str = None
    form_data: str = None
    ai_tool: str = None
    generated_asset_url: str = None
    priority: str = None


class BriefsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    brief_type: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    brand_name: Optional[str] = None
    project_description: Optional[str] = None
    target_audience: Optional[str] = None
    tone_style: Optional[str] = None
    dimensions: Optional[str] = None
    platform: Optional[str] = None
    key_message: Optional[str] = None
    additional_notes: Optional[str] = None
    form_data: Optional[str] = None
    ai_tool: Optional[str] = None
    generated_asset_url: Optional[str] = None
    priority: Optional[str] = None


class BriefsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    brief_type: str
    title: str
    status: str
    brand_name: Optional[str] = None
    project_description: Optional[str] = None
    target_audience: Optional[str] = None
    tone_style: Optional[str] = None
    dimensions: Optional[str] = None
    platform: Optional[str] = None
    key_message: Optional[str] = None
    additional_notes: Optional[str] = None
    form_data: Optional[str] = None
    ai_tool: Optional[str] = None
    generated_asset_url: Optional[str] = None
    priority: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BriefsListResponse(BaseModel):
    """List response schema"""
    items: List[BriefsResponse]
    total: int
    skip: int
    limit: int


class BriefsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[BriefsData]


class BriefsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: BriefsUpdateData


class BriefsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[BriefsBatchUpdateItem]


class BriefsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=BriefsListResponse)
async def query_briefss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query briefss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying briefss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = BriefsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} briefss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying briefss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=BriefsListResponse)
async def query_briefss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query briefss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying briefss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = BriefsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} briefss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying briefss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=BriefsResponse)
async def get_briefs(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single briefs by ID (user can only see their own records)"""
    logger.debug(f"Fetching briefs with id: {id}, fields={fields}")
    
    service = BriefsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Briefs with id {id} not found")
            raise HTTPException(status_code=404, detail="Briefs not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching briefs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=BriefsResponse, status_code=201)
async def create_briefs(
    data: BriefsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new briefs"""
    logger.debug(f"Creating new briefs with data: {data}")
    
    service = BriefsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create briefs")
        
        logger.info(f"Briefs created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating briefs: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating briefs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[BriefsResponse], status_code=201)
async def create_briefss_batch(
    request: BriefsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple briefss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} briefss")
    
    service = BriefsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} briefss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[BriefsResponse])
async def update_briefss_batch(
    request: BriefsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple briefss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} briefss")
    
    service = BriefsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} briefss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=BriefsResponse)
async def update_briefs(
    id: int,
    data: BriefsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing briefs (requires ownership)"""
    logger.debug(f"Updating briefs {id} with data: {data}")

    service = BriefsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Briefs with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Briefs not found")
        
        logger.info(f"Briefs {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating briefs {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating briefs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_briefss_batch(
    request: BriefsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple briefss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} briefss")
    
    service = BriefsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} briefss successfully")
        return {"message": f"Successfully deleted {deleted_count} briefss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_briefs(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single briefs by ID (requires ownership)"""
    logger.debug(f"Deleting briefs with id: {id}")
    
    service = BriefsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Briefs with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Briefs not found")
        
        logger.info(f"Briefs {id} deleted successfully")
        return {"message": "Briefs deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting briefs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")