import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.db import Base, GUID


class ScanFavorite(Base):
    __tablename__ = "scan_favorites"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, index=True)

    scan_type = Column(String, nullable=False)  # "meal" or "product"
    source_scan_id = Column(GUID, nullable=False)  # original scan ID
    label = Column(String, nullable=False)
    ingredients = Column(JSON, default=list)
    nutrition_snapshot = Column(JSON, default=dict)
    fuel_score = Column(Float, nullable=True)
    whole_food_status = Column(String, nullable=True)
    image_bucket = Column(String, nullable=True)
    image_path = Column(String, nullable=True)
    image_mime_type = Column(String, nullable=True)
    image_url = Column(String, nullable=True)

    # Product-specific fields
    barcode = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    product_tier = Column(String, nullable=True)
    product_analysis = Column(JSON, default=dict)

    # Meal-specific fields
    meal_type = Column(String, nullable=True)
    portion_size = Column(String, nullable=True)
    source_context = Column(String, nullable=True)

    use_count = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
