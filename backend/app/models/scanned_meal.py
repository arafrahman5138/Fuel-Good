import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, JSON, String
from sqlalchemy.orm import relationship

from app.db import Base, GUID


class ScannedMealLog(Base):
    __tablename__ = "scanned_meal_logs"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, index=True)

    image_url = Column(String, nullable=True)
    meal_label = Column(String, nullable=False)
    scan_mode = Column(String, default="meal")
    meal_context = Column(String, nullable=True)
    meal_type = Column(String, nullable=True)
    portion_size = Column(String, nullable=True)
    source_context = Column(String, nullable=True)

    estimated_ingredients = Column(JSON, default=list)
    normalized_ingredients = Column(JSON, default=list)
    nutrition_estimate = Column(JSON, default=dict)

    whole_food_status = Column(String, nullable=True)
    whole_food_flags = Column(JSON, default=list)
    suggested_swaps = Column(JSON, default=list)

    mes_score = Column(Float, nullable=True)
    mes_tier = Column(String, nullable=True)
    mes_sub_scores = Column(JSON, default=dict)

    confidence = Column(Float, default=0.0)
    confidence_breakdown = Column(JSON, default=dict)
    source_model = Column(String, nullable=True)
    matched_recipe_id = Column(String, nullable=True)
    logged_food_log_id = Column(GUID, ForeignKey("food_logs.id"), nullable=True)
    logged_to_chronometer = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    food_log = relationship("FoodLog")
