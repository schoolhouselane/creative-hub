from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, Text


class Brand_profiles(Base):
    __tablename__ = "brand_profiles"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    brand_name = Column(String, nullable=False)
    primary_color = Column(String, nullable=True)
    secondary_color = Column(String, nullable=True)
    accent_color = Column(String, nullable=True)
    font_heading = Column(String, nullable=True)
    font_body = Column(String, nullable=True)
    tone_of_voice = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    tagline = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    guidelines_notes = Column(String, nullable=True)
    brand_dna = Column(Text, nullable=True)
    chat_history = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)