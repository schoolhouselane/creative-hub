from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, String, Boolean


class ClientUser(Base):
    __tablename__ = "client_users"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True, index=True, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    last_login = Column(DateTime(timezone=True), nullable=True)
