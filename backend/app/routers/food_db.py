from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, cast, String as SAString
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.local_food import LocalFood
from app.models.user import User
from app.services.food_catalog import serialize_food_detail, serialize_food_search


router = APIRouter()


@router.get("/search")
async def search_foods(
    q: str = Query(..., description="Search query"),
    page: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    page_size = 20
    query_str = (q or "").strip()
    if len(query_str) < 2:
        return {"foods": [], "total": 0, "page": page}

    pattern = f"%{query_str}%"
    base = (
        db.query(LocalFood)
        .filter(
            LocalFood.is_active.is_(True),
            or_(
                LocalFood.name.ilike(pattern),
                LocalFood.brand.ilike(pattern),
                LocalFood.category.ilike(pattern),
                cast(LocalFood.aliases, SAString).ilike(pattern),
            ),
        )
        .order_by(LocalFood.name.asc())
    )

    total = base.count()
    offset = (page - 1) * page_size
    foods = base.offset(offset).limit(page_size).all()

    return {
        "foods": [serialize_food_search(food) for food in foods],
        "total": total,
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
