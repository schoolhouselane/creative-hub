from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, String


class StaffUser(Base):
    __tablename__ = "staff_users"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True, index=True, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, default="staff", nullable=False)  # staff | admin
    created_at = Column(DateTime(timezone=True), default=datetime.now)
