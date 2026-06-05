import base64
import json
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.brand_profiles import Brand_profilesService
from services.brand_guidelines import (
    extract_text_from_pdf,
    extract_brand_dna,
    save_pdf_to_brand_folder,
    save_dna_json,
    list_brand_files,
    get_brand_folder,
)
from services.aihub import AIHubService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/brand_profiles", tags=["brand_profiles"])


# ---------- Pydantic Schemas ----------
class Brand_profilesData(BaseModel):
    """Entity data schema (for create/update)"""
    brand_name: str
    primary_color: str = None
    secondary_color: str = None
    accent_color: str = None
    font_heading: str = None
    font_body: str = None
    tone_of_voice: str = None
    logo_url: str = None
    tagline: str = None
    industry: str = None
    guidelines_notes: str = None
    brand_dna: Optional[str] = None


class Brand_profilesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    brand_name: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    font_heading: Optional[str] = None
    font_body: Optional[str] = None
    tone_of_voice: Optional[str] = None
    logo_url: Optional[str] = None
    tagline: Optional[str] = None
    industry: Optional[str] = None
    guidelines_notes: Optional[str] = None
    brand_dna: Optional[str] = None


class Brand_profilesResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    brand_name: str
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    font_heading: Optional[str] = None
    font_body: Optional[str] = None
    tone_of_voice: Optional[str] = None
    logo_url: Optional[str] = None
    tagline: Optional[str] = None
    industry: Optional[str] = None
    guidelines_notes: Optional[str] = None
    brand_dna: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Brand_profilesListResponse(BaseModel):
    """List response schema"""
    items: List[Brand_profilesResponse]
    total: int
    skip: int
    limit: int


class Brand_profilesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Brand_profilesData]


class Brand_profilesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Brand_profilesUpdateData


class Brand_profilesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Brand_profilesBatchUpdateItem]


class Brand_profilesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Brand_profilesListResponse)
async def query_brand_profiless(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query brand_profiless with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying brand_profiless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Brand_profilesService(db)
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
        logger.debug(f"Found {result['total']} brand_profiless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying brand_profiless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Brand_profilesListResponse)
async def query_brand_profiless_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query brand_profiless with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying brand_profiless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Brand_profilesService(db)
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
        logger.debug(f"Found {result['total']} brand_profiless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying brand_profiless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Brand_profilesResponse)
async def get_brand_profiles(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single brand_profiles by ID (user can only see their own records)"""
    logger.debug(f"Fetching brand_profiles with id: {id}, fields={fields}")
    
    service = Brand_profilesService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Brand_profiles with id {id} not found")
            raise HTTPException(status_code=404, detail="Brand_profiles not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching brand_profiles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Brand_profilesResponse, status_code=201)
async def create_brand_profiles(
    data: Brand_profilesData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new brand_profiles"""
    logger.debug(f"Creating new brand_profiles with data: {data}")
    
    service = Brand_profilesService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create brand_profiles")
        
        logger.info(f"Brand_profiles created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating brand_profiles: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating brand_profiles: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Brand_profilesResponse], status_code=201)
async def create_brand_profiless_batch(
    request: Brand_profilesBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple brand_profiless in a single request"""
    logger.debug(f"Batch creating {len(request.items)} brand_profiless")
    
    service = Brand_profilesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} brand_profiless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Brand_profilesResponse])
async def update_brand_profiless_batch(
    request: Brand_profilesBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple brand_profiless in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} brand_profiless")
    
    service = Brand_profilesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} brand_profiless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Brand_profilesResponse)
async def update_brand_profiles(
    id: int,
    data: Brand_profilesUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing brand_profiles (requires ownership)"""
    logger.debug(f"Updating brand_profiles {id} with data: {data}")

    service = Brand_profilesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Brand_profiles with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Brand_profiles not found")
        
        logger.info(f"Brand_profiles {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating brand_profiles {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating brand_profiles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_brand_profiless_batch(
    request: Brand_profilesBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple brand_profiless by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} brand_profiless")
    
    service = Brand_profilesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} brand_profiless successfully")
        return {"message": f"Successfully deleted {deleted_count} brand_profiless", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_brand_profiles(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single brand_profiles by ID (requires ownership)"""
    logger.debug(f"Deleting brand_profiles with id: {id}")

    service = Brand_profilesService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Brand_profiles with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Brand_profiles not found")

        logger.info(f"Brand_profiles {id} deleted successfully")
        return {"message": "Brand_profiles deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting brand_profiles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ── Brand Guidelines PDF Upload ────────────────────────────────────────────────

@router.post("/{id}/upload-guidelines")
async def upload_brand_guidelines(
    id: int,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a brand guidelines PDF.
    - Saves PDF to uploads/brands/{id}-{slug}/brand_guidelines.pdf
    - Extracts text with PyMuPDF
    - Sends to Gemini to extract structured brand DNA JSON
    - Saves brand_dna.json to brand folder
    - Updates brand_profiles.brand_dna in DB
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    service = Brand_profilesService(db)
    brand = await service.get_by_id(id, user_id=str(current_user.id))
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 50 * 1024 * 1024:  # 50 MB hard limit
        raise HTTPException(status_code=413, detail="PDF too large — max 50 MB")

    try:
        # 1. Save PDF to brand folder
        save_pdf_to_brand_folder(pdf_bytes, id, brand.brand_name)

        # 2. Extract text
        pdf_text = extract_text_from_pdf(pdf_bytes)
        if not pdf_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF — it may be image-only")

        # 3. Extract structured brand DNA via Gemini
        ai = AIHubService()
        dna = await extract_brand_dna(pdf_text, ai)

        # 4. Save JSON to brand folder
        save_dna_json(dna, id, brand.brand_name)

        # 5. Merge extracted fields into brand_profiles columns
        update_data: dict = {"brand_dna": json.dumps(dna, ensure_ascii=False)}
        if dna.get("primary_color") and not brand.primary_color:
            update_data["primary_color"] = dna["primary_color"]
        if dna.get("secondary_color") and not brand.secondary_color:
            update_data["secondary_color"] = dna["secondary_color"]
        if dna.get("accent_color") and not brand.accent_color:
            update_data["accent_color"] = dna["accent_color"]
        if dna.get("font_heading") and not brand.font_heading:
            update_data["font_heading"] = dna["font_heading"]
        if dna.get("font_body") and not brand.font_body:
            update_data["font_body"] = dna["font_body"]
        if dna.get("tone_of_voice") and not brand.tone_of_voice:
            update_data["tone_of_voice"] = dna["tone_of_voice"]
        if dna.get("tagline") and not brand.tagline:
            update_data["tagline"] = dna["tagline"]
        if dna.get("industry") and not brand.industry:
            update_data["industry"] = dna["industry"]

        await service.update(id, update_data, user_id=str(current_user.id))

        return {
            "success": True,
            "brand_id": id,
            "brand_name": brand.brand_name,
            "pages_extracted": len(pdf_text.split("\n\n")),
            "dna": dna,
            "files": list_brand_files(id, brand.brand_name),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Guidelines upload failed for brand {id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}/files")
async def list_brand_files_endpoint(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all files in a brand's folder."""
    service = Brand_profilesService(db)
    brand = await service.get_by_id(id, user_id=str(current_user.id))
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"brand_id": id, "files": list_brand_files(id, brand.brand_name)}

# ─── Brand Chat History (persistent project memory) ────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str
    image_url: Optional[str] = None
    attached_image: Optional[str] = None
    saved: Optional[bool] = None


class SaveChatRequest(BaseModel):
    messages: List[ChatMessage]


@router.get("/{id}/chat")
async def get_brand_chat(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Load the persistent chat history for a brand (the 'project memory')."""
    service = Brand_profilesService(db)
    brand = await service.get_by_id(id, user_id=str(current_user.id))
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    try:
        messages = json.loads(brand.chat_history or "[]")
    except Exception:
        messages = []
    return {"brand_id": id, "messages": messages}


@router.post("/{id}/chat")
async def save_brand_chat(
    id: int,
    body: SaveChatRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist the full chat history for a brand after each exchange."""
    service = Brand_profilesService(db)
    brand = await service.get_by_id(id, user_id=str(current_user.id))
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    # Strip base64 image data from history before saving — store URL references only.
    # This keeps the stored JSON small; product/layout images are re-fetched from brand_dna.
    clean = []
    for m in body.messages:
        clean.append({
            "role": m.role,
            "content": m.content,
            "image_url": m.image_url if (m.image_url and not m.image_url.startswith("data:")) else None,
            "saved": m.saved,
        })

    await service.update(id, {"chat_history": json.dumps(clean)}, user_id=str(current_user.id))
    return {"success": True, "message_count": len(clean)}


class SaveImageRequest(BaseModel):
    data_uri: str  # "data:image/png;base64,..."


_UPLOADS_ROOT = Path(__file__).parent.parent / "uploads" / "generated"


@router.post("/{id}/save-image")
async def save_generated_image(
    id: int,
    body: SaveImageRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Convert a base64 data URI into a stable local file and return its URL."""
    service = Brand_profilesService(db)
    brand = await service.get_by_id(id, user_id=str(current_user.id))
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    try:
        header, b64data = body.data_uri.split(",", 1)
        ext = "png"
        if "jpeg" in header or "jpg" in header:
            ext = "jpg"
        elif "webp" in header:
            ext = "webp"
        image_bytes = base64.b64decode(b64data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid data URI")

    brand_dir = _UPLOADS_ROOT / str(id)
    brand_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    (brand_dir / filename).write_bytes(image_bytes)

    url = f"/uploads/generated/{id}/{filename}"
    return {"url": url}
