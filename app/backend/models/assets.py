from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, Text


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False, index=True)
    brand_id = Column(Integer, nullable=True, index=True)
    brand_name = Column(String, nullable=True)
    title = Column(String, nullable=True)
    asset_type = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    ai_tool = Column(String, nullable=True)
    url = Column(Text, nullable=True)
    prompt = Column(Text, nullable=True)
    chat_history = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
