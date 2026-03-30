import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, String, Integer, DateTime, JSON
from sqlalchemy.orm import relationship
from app.db import Base, GUID


class User(Base):
    __tablename__ = "users"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    name = Column(String, nullable=False)
    auth_provider = Column(String, default="email")
    provider_subject = Column(String, nullable=True, index=True)
    dietary_preferences = Column(JSON, default=list)
    flavor_preferences = Column(JSON, default=list)
    allergies = Column(JSON, default=list)
    liked_ingredients = Column(JSON, default=list)
    disliked_ingredients = Column(JSON, default=list)
    protein_preferences = Column(JSON, default=dict)
    cooking_time_budget = Column(JSON, default=dict)
    household_size = Column(Integer, default=1)
    budget_level = Column(String, default="medium")
    xp_points = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_active_date = Column(DateTime, nullable=True)
    revenuecat_customer_id = Column(String, nullable=True, index=True)
    subscription_product_id = Column(String, nullable=True)
    subscription_store = Column(String, nullable=True)
    subscription_status = Column(String, default="inactive")
    subscription_trial_started_at = Column(DateTime, nullable=True)
    subscription_trial_ends_at = Column(DateTime, nullable=True)
    subscription_current_period_ends_at = Column(DateTime, nullable=True)
    subscription_will_renew = Column(Boolean, default=False)
    subscription_manage_url = Column(String, nullable=True)
    subscription_last_synced_at = Column(DateTime, nullable=True)
    password_reset_code_hash = Column(String, nullable=True)
    password_reset_code_expires_at = Column(DateTime, nullable=True)
    access_override_level = Column(String, nullable=True)
    access_override_reason = Column(String, nullable=True)
    access_override_expires_at = Column(DateTime, nullable=True)
    access_override_updated_at = Column(DateTime, nullable=True)
    fuel_target = Column(Integer, nullable=True, default=80)
    expected_meals_per_week = Column(Integer, nullable=True, default=21)
    clean_eating_pct = Column(Integer, nullable=True, default=80)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    meal_plans = relationship("MealPlan", back_populates="user")
    grocery_lists = relationship("GroceryList", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")
    achievements = relationship("UserAchievement", back_populates="user")
    push_tokens = relationship("UserPushToken", back_populates="user")
