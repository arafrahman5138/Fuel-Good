from pydantic import BaseModel
from typing import Optional, List


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatContext(BaseModel):
    """Optional rich context passed from other screens (scan result, recipe detail, etc.)"""
    source: Optional[str] = None  # "scan", "recipe", "home", "flex", "photo"
    scan_result: Optional[dict] = None  # fuel_score, flags, meal_label from a scan
    recipe_id: Optional[str] = None
    flex_status: Optional[dict] = None  # earned, remaining, weekly_avg
    image_base64: Optional[str] = None  # base64-encoded image for photo-based chat
    image_type: Optional[str] = None  # "auto", "fridge", "meal", "grocery", "label"


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    context: Optional[ChatContext] = None


class ChatResponse(BaseModel):
    session_id: str
    message: ChatMessage
    healthified_recipe: Optional[dict] = None
    ingredient_swaps: Optional[List[dict]] = None
    nutrition_comparison: Optional[dict] = None
    mes_score: Optional[dict] = None


class ChatSessionSummary(BaseModel):
    id: str
    title: str
    created_at: str
    message_count: int
