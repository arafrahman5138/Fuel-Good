from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from app.schemas.billing import EntitlementInfo


def _validate_password_strength(v: str) -> str:
    if not any(c.isupper() for c in v):
        raise ValueError('Password must contain at least one uppercase letter')
    if not any(c.islower() for c in v):
        raise ValueError('Password must contain at least one lowercase letter')
    if not any(c.isdigit() for c in v):
        raise ValueError('Password must contain at least one number')
    return v


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class SocialAuthRequest(BaseModel):
    provider: str  # "google" or "apple"
    token: str
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    provider_subject: Optional[str] = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetRequestResponse(BaseModel):
    message: str
    reset_code: Optional[str] = None
    expires_in_minutes: Optional[int] = None


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator('new_password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class PasswordResetConfirmResponse(BaseModel):
    message: str


class Token(BaseModel):
    access_token: str
    refresh_token: str = ""
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    auth_provider: str
    dietary_preferences: list
    flavor_preferences: list
    allergies: list
    liked_ingredients: list
    disliked_ingredients: list
    protein_preferences: dict
    cooking_time_budget: dict
    household_size: int
    budget_level: str
    xp_points: int
    current_streak: int
    longest_streak: int
    entitlement: EntitlementInfo
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class UserPreferencesUpdate(BaseModel):
    dietary_preferences: Optional[list] = None
    flavor_preferences: Optional[list] = None
    allergies: Optional[list] = None
    liked_ingredients: Optional[list] = None
    disliked_ingredients: Optional[list] = None
    protein_preferences: Optional[dict] = None
    cooking_time_budget: Optional[dict] = None
    household_size: Optional[int] = None
    budget_level: Optional[str] = None
