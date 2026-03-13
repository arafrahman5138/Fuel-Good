from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.local_food import LocalFood
from app.models.user import User
from app.services.food_catalog import serialize_food_detail, serialize_food_search


router = APIRouter()


def _matches_query(food: LocalFood, query: str) -> bool:
    q = (query or "").strip().lower()
    haystacks = [
        food.name or "",
        food.brand or "",
        food.category or "",
        " ".join(food.aliases or []),
    ]
    return any(q in value.lower() for value in haystacks)


@router.get("/search")
async def search_foods(
    q: str = Query(..., description="Search query"),
    page: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    page_size = 20
    query = (q or "").strip()
    if len(query) < 2:
        return {"foods": [], "total": 0, "page": page}

    foods = (
        db.query(LocalFood)
        .filter(LocalFood.is_active.is_(True))
        .order_by(LocalFood.name.asc())
        .all()
    )
    matches = [food for food in foods if _matches_query(food, query)]
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "foods": [serialize_food_search(food) for food in matches[start:end]],
        "total": len(matches),
        "page": page,
    }


@router.get("/{food_id}")
async def get_food_detail(
    food_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    item = db.query(LocalFood).filter(LocalFood.id == food_id, LocalFood.is_active.is_(True)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Food not found")
    return serialize_food_detail(item)
