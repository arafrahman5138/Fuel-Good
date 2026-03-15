import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, JSON, String
from sqlalchemy.orm import relationship

from app.db import Base, GUID


class ProductLabelScan(Base):
    __tablename__ = "product_label_scans"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, index=True)
    capture_type = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    image_bucket = Column(String, nullable=True)
    image_path = Column(String, nullable=True)
    image_mime_type = Column(String, nullable=True)
    product_name = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    ingredients_text = Column(String, nullable=True)
    confidence = Column(Float, default=0.0)
    confidence_breakdown = Column(JSON, default=dict)
    analysis = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
