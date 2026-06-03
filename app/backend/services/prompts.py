import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.prompts import Prompt

logger = logging.getLogger(__name__)


class PromptsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Prompt]:
        try:
            if user_id:
                data["user_id"] = user_id
            obj = Prompt(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating prompt: {e}")
            raise

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Prompt]:
        try:
            query = select(Prompt).where(Prompt.id == obj_id)
            if user_id:
                query = query.where(Prompt.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching prompt {obj_id}: {e}")
            raise

    async def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            query = select(Prompt)
            count_query = select(func.count(Prompt.id))

            if user_id:
                query = query.where(Prompt.user_id == user_id)
                count_query = count_query.where(Prompt.user_id == user_id)

            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Prompt, field):
                        query = query.where(getattr(Prompt, field) == value)
                        count_query = count_query.where(getattr(Prompt, field) == value)

            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith("-"):
                    field_name = sort[1:]
                    if hasattr(Prompt, field_name):
                        query = query.order_by(getattr(Prompt, field_name).desc())
                else:
                    if hasattr(Prompt, sort):
                        query = query.order_by(getattr(Prompt, sort))
            else:
                query = query.order_by(Prompt.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {"items": items, "total": total, "skip": skip, "limit": limit}
        except Exception as e:
            logger.error(f"Error fetching prompt list: {e}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Prompt]:
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != "user_id":
                    setattr(obj, key, value)
            await self.db.commit()
            await self.db.refresh(obj)
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating prompt {obj_id}: {e}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                return False
            await self.db.delete(obj)
            await self.db.commit()
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting prompt {obj_id}: {e}")
            raise
