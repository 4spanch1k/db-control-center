import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.core.auth_utils import (
    ALLOWED_ROLES,
    ROLE_VIEWER,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_access_token_ttl_seconds,
    get_refresh_token_ttl_seconds,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter()

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"
COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower()
COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN") or None


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    cookie_params = {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "path": "/",
        "domain": COOKIE_DOMAIN,
    }

    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        max_age=get_access_token_ttl_seconds(),
        **cookie_params,
    )

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=get_refresh_token_ttl_seconds(),
        **cookie_params,
    )


class LoginSchema(BaseModel):
    email: str
    password: str


class RegisterSchema(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    success: bool
    token_type: str
    access_token: str
    refresh_token: str
    access_token_expires_in: int
    refresh_token_expires_in: int


class UserProfileResponse(BaseModel):
    success: bool
    user: dict


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginSchema, response: Response):
    import main

    if not getattr(main, "db_manager", None):
        raise HTTPException(status_code=500, detail="Database manager not initialized")

    user = await main.db_manager.get_user_by_email(credentials.email)
    if not user or not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Пользователь деактивирован")

    access_token = create_access_token(data={"sub": user["email"]})
    refresh_token = create_refresh_token(data={"sub": user["email"]})
    _set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        success=True,
        token_type="bearer",
        access_token=access_token,
        refresh_token=refresh_token,
        access_token_expires_in=get_access_token_ttl_seconds(),
        refresh_token_expires_in=get_refresh_token_ttl_seconds(),
    )


@router.post("/auth/register", response_model=TokenResponse)
async def register(payload: RegisterSchema, response: Response):
    import main

    if not getattr(main, "db_manager", None):
        raise HTTPException(status_code=500, detail="Database manager not initialized")

    email = payload.email.strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Неверный формат email")

    if len(payload.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Пароль должен содержать минимум 8 символов",
        )

    existing_user = await main.db_manager.get_user_by_email(email)
    if existing_user:
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")

    try:
        await main.db_manager.create_user(
            email,
            hash_password(payload.password),
            role=ROLE_VIEWER,
        )
    except Exception as exc:
        if "duplicate key value violates unique constraint" in str(exc).lower():
            raise HTTPException(
                status_code=409,
                detail="Пользователь с таким email уже существует",
            ) from exc
        raise HTTPException(status_code=500, detail="Не удалось создать пользователя") from exc

    access_token = create_access_token(data={"sub": email})
    refresh_token = create_refresh_token(data={"sub": email})
    _set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        success=True,
        token_type="bearer",
        access_token=access_token,
        refresh_token=refresh_token,
        access_token_expires_in=get_access_token_ttl_seconds(),
        refresh_token_expires_in=get_refresh_token_ttl_seconds(),
    )


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(request: Request, response: Response):
    import main

    if not getattr(main, "db_manager", None):
        raise HTTPException(status_code=500, detail="Database manager not initialized")

    refresh_cookie: Optional[str] = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_cookie:
        raise HTTPException(status_code=401, detail="Refresh token отсутствует")

    try:
        email = decode_refresh_token(refresh_cookie)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Refresh token недействителен") from exc

    user = await main.db_manager.get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    access_token = create_access_token(data={"sub": user["email"]})
    refresh_token_value = create_refresh_token(data={"sub": user["email"]})
    _set_auth_cookies(response, access_token, refresh_token_value)

    return TokenResponse(
        success=True,
        token_type="bearer",
        access_token=access_token,
        refresh_token=refresh_token_value,
        access_token_expires_in=get_access_token_ttl_seconds(),
        refresh_token_expires_in=get_refresh_token_ttl_seconds(),
    )


@router.post("/auth/logout")
async def logout(response: Response):
    cookie_params = {
        "path": "/",
        "domain": COOKIE_DOMAIN,
    }
    response.delete_cookie(ACCESS_COOKIE_NAME, **cookie_params)
    response.delete_cookie(REFRESH_COOKIE_NAME, **cookie_params)
    return {"success": True, "message": "Logged out"}


@router.get("/auth/me", response_model=UserProfileResponse)
async def me(current_user=Depends(get_current_user)):
    role = str(current_user.get("role", ROLE_VIEWER)).lower()
    normalized_role = role if role in ALLOWED_ROLES else ROLE_VIEWER
    return {
        "success": True,
        "user": {
            "id": str(current_user["id"]),
            "email": current_user["email"],
            "is_active": bool(current_user.get("is_active", True)),
            "role": normalized_role,
        },
    }
