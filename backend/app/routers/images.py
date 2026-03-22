"""
Image generation endpoints for meal/recipe cards.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.recipe import Recipe
from app.services.food_image import generate_image_for_recipe

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate/{recipe_id}")
async def generate_recipe_image(
    recipe_id: str,
    force: bool = Query(False, description="Regenerate even if image exists"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an AI food image for a single recipe."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # If already has image and not forcing, return existing
    if recipe.image_url and not force:
        return {"recipe_id": recipe_id, "image_url": recipe.image_url, "status": "existing"}

    image_url = await generate_image_for_recipe(
        title=recipe.title,
        description=recipe.description,
        force=force,
    )

    if not image_url:
        raise HTTPException(status_code=502, detail="Image generation failed")

    recipe.image_url = image_url
    db.commit()

    return {"recipe_id": recipe_id, "image_url": image_url, "status": "generated"}


@router.post("/generate-batch")
async def generate_batch_images(
    limit: int = Query(10, ge=1, le=50, description="Max recipes to process"),
    force: bool = Query(False, description="Regenerate existing images"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate images for recipes that don't have one yet.
    Processes up to `limit` recipes at a time.
    """
    query = db.query(Recipe)
    if not force:
        query = query.filter(
            (Recipe.image_url == None) | (Recipe.image_url == "")  # noqa: E711
        )
    recipes = query.limit(limit).all()

    results = []
    for recipe in recipes:
        image_url = await generate_image_for_recipe(
            title=recipe.title,
            description=recipe.description,
            force=force,
        )
        if image_url:
            recipe.image_url = image_url
            results.append({
                "recipe_id": str(recipe.id),
                "title": recipe.title,
                "image_url": image_url,
                "status": "generated",
            })
        else:
            results.append({
                "recipe_id": str(recipe.id),
                "title": recipe.title,
                "image_url": None,
                "status": "failed",
            })

    db.commit()

    generated = sum(1 for r in results if r["status"] == "generated")
    return {
        "processed": len(results),
        "generated": generated,
        "failed": len(results) - generated,
        "results": results,
    }
