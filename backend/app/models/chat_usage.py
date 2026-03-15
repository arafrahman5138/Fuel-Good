import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db import Base, GUID


class ChatUsageEvent(Base):
    __tablename__ = "chat_usage_events"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, index=True)
    route = Column(String, nullable=False, default="healthify")
    response_mode = Column(String, nullable=False, default="unknown")
    cost_units = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User")
