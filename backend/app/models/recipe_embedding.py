import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from app.db import Base, GUID
from app.config import get_settings


settings = get_settings()


class RecipeEmbedding(Base):
    __tablename__ = "recipe_embeddings"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id = Column(GUID, ForeignKey("recipes.id"), nullable=False, unique=True, index=True)
    provider = Column(String, nullable=False, default="none")
    model = Column(String, nullable=False, default="")
    text_hash = Column(String, nullable=False, default="", index=True)
    vector = Column(JSON, default=list)
    embedding = Column(Vector(settings.embedding_dimension), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipe = relationship("Recipe")
