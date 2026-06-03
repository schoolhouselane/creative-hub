import json
import logging
from typing import List, Optional

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.assets import AssetsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/assets", tags=["assets"])


# ---------- Pydantic Schemas ----------
class AssetCreate(BaseModel):
    """Entity data schema (for create)"""
    brand_id: Optional[int] = None
    brand_name: Optional[str] = None
    title: Optional[str] = None
    asset_type: str
    content_type: Optional[str] = None
    ai_tool: Optional[str] = None
    url: Optional[str] = None
    prompt: Optional[str] = None
    chat_history: Optional[str] = None


class AssetUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    brand_id: Optional[int] = None
    brand_name: Optional[str] = None
    title: Optional[str] = None
    asset_type: Optional[str] = None
    content_type: Optional[str] = None
    ai_tool: Optional[str] = None
    url: Optional[str] = None
    prompt: Optional[str] = None
    chat_history: Optional[str] = None


class AssetResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    brand_id: Optional[int] = None
    brand_name: Optional[str] = None
    title: Optional[str] = None
    asset_type: str
    content_type: Optional[str] = None
    ai_tool: Optional[str] = None
    url: Optional[str] = None
    prompt: Optional[str] = None
    chat_history: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssetListResponse(BaseModel):
    """List response schema"""
    items: List[AssetResponse]
    total: int
    skip: int
    limit: int


class AssetBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[AssetCreate]


class AssetBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: AssetUpdateData


class AssetBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[AssetBatchUpdateItem]


class AssetBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=AssetListResponse)
async def query_assets(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    brand_id: Optional[int] = Query(None, description="Filter by brand ID"),
    asset_type: Optional[str] = Query(None, description="Filter by asset type"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query assets with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying assets: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = AssetsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        # Apply convenience filter params on top of any JSON query
        if query_dict is None:
            query_dict = {}
        if brand_id is not None:
            query_dict["brand_id"] = brand_id
        if asset_type is not None:
            query_dict["asset_type"] = asset_type
        if not query_dict:
            query_dict = None

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} assets")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying assets: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=AssetListResponse)
async def query_assets_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query assets with filtering, sorting, and pagination without user limitation"""
    logger.debug(f"Querying assets: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = AssetsService(db)
    try:
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
        )
        logger.debug(f"Found {result['total']} assets")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying assets: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=AssetResponse)
async def get_asset(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single asset by ID (user can only see their own records)"""
    logger.debug(f"Fetching asset with id: {id}, fields={fields}")

    service = AssetsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Asset with id {id} not found")
            raise HTTPException(status_code=404, detail="Asset not found")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching asset {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(
    data: AssetCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new asset"""
    logger.debug(f"Creating new asset with data: {data}")

    service = AssetsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create asset")

        logger.info(f"Asset created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating asset: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating asset: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[AssetResponse], status_code=201)
async def create_assets_batch(
    request: AssetBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple assets in a single request"""
    logger.debug(f"Batch creating {len(request.items)} assets")

    service = AssetsService(db)
    results = []

    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)

        logger.info(f"Batch created {len(results)} assets successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[AssetResponse])
async def update_assets_batch(
    request: AssetBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple assets in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} assets")

    service = AssetsService(db)
    results = []

    try:
        for item in request.items:
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)

        logger.info(f"Batch updated {len(results)} assets successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=AssetResponse)
async def update_asset(
    id: int,
    data: AssetUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing asset (requires ownership)"""
    logger.debug(f"Updating asset {id} with data: {data}")

    service = AssetsService(db)
    try:
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Asset with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Asset not found")

        logger.info(f"Asset {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating asset {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating asset {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_assets_batch(
    request: AssetBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple assets by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} assets")

    service = AssetsService(db)
    deleted_count = 0

    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1

        logger.info(f"Batch deleted {deleted_count} assets successfully")
        return {"message": f"Successfully deleted {deleted_count} assets", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_asset(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single asset by ID (requires ownership)"""
    logger.debug(f"Deleting asset with id: {id}")

    service = AssetsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Asset with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Asset not found")

        logger.info(f"Asset {id} deleted successfully")
        return {"message": "Asset deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting asset {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
