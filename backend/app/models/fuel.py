import uuid
from datetime import datetime, date

from sqlalchemy import Column, String, DateTime, Date, Float, Integer, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base, GUID


class DailyFuelSummary(Base):
    __tablename__ = "daily_fuel_summaries"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    avg_fuel_score = Column(Float, default=0.0)
    meal_count = Column(Integer, default=0)
    total_score_points = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_fuel_user_date"),
    )


class WeeklyFuelSummary(Base):
    __tablename__ = "weekly_fuel_summaries"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, index=True)
    week_start = Column(Date, nullable=False, index=True)

    avg_fuel_score = Column(Float, default=0.0)
    meal_count = Column(Integer, default=0)
    total_score_points = Column(Float, default=0.0)
    flex_meals_used = Column(Integer, default=0)
    flex_budget_total = Column(Float, default=0.0)
    flex_budget_remaining = Column(Float, default=0.0)
    target_met = Column(Boolean, default=False)
    streak_weeks = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "week_start", name="uq_weekly_fuel_user_week"),
    )
