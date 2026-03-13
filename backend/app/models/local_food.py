import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, Float, String, JSON, DateTime
from app.db import Base, GUID


class LocalFood(Base):
    __tablename__ = "local_foods"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True, index=True)
    brand = Column(String, nullable=True)
    category = Column(String, default="Whole Foods")
    source_kind = Column(String, default="whole_food")
    aliases = Column(JSON, default=list)
    default_serving_label = Column(String, default="1 serving")
    default_serving_grams = Column(Float, default=100.0)
    serving_options = Column(JSON, default=list)
    nutrition_per_100g = Column(JSON, default=dict)
    nutrition_per_serving = Column(JSON, default=dict)
    mes_ready_nutrition = Column(JSON, default=dict)
    micronutrients = Column(JSON, default=dict)
    nutrition_info = Column(JSON, default=dict)  # legacy alias for per-serving nutrition
    serving = Column(String, default="1 serving")  # legacy alias for default serving label
    tags = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
