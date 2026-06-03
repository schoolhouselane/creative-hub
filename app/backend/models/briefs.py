from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Briefs(Base):
    __tablename__ = "briefs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    brief_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    status = Column(String, nullable=False)
    brand_name = Column(String, nullable=True)
    project_description = Column(String, nullable=True)
    target_audience = Column(String, nullable=True)
    tone_style = Column(String, nullable=True)
    dimensions = Column(String, nullable=True)
    platform = Column(String, nullable=True)
    key_message = Column(String, nullable=True)
    additional_notes = Column(String, nullable=True)
    form_data = Column(String, nullable=True)
    ai_tool = Column(String, nullable=True)
    generated_asset_url = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)