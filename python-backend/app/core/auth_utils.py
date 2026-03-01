import os
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional
from uuid import uuid4

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", SECRET_KEY)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"
ROLE_ADMIN = "admin"
ROLE_OPERATOR = "operator"
ROLE_VIEWER = "viewer"
ALLOWED_ROLES = {ROLE_ADMIN, ROLE_OPERATOR, ROLE_VIEWER}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _create_token(
    data: dict,
    expires_delta: timedelta,
    token_type: str,
    secret_key: str,
) -> str:
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    expire = now_utc + expires_delta
    to_encode.update(
        {
            "exp": expire,
            "iat": now_utc,
            "jti": str(uuid4()),
            "type": token_type,
        }
    )
    return jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)


def create_access_token(data: dict) -> str:
    return _create_token(
        data=data,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type=ACCESS_TOKEN_TYPE,
        secret_key=SECRET_KEY,
    )


def create_refresh_token(data: dict) -> str:
    return _create_token(
        data=data,
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        token_type=REFRESH_TOKEN_TYPE,
        secret_key=REFRESH_SECRET_KEY,
    )


def get_access_token_ttl_seconds() -> int:
    return ACCESS_TOKEN_EXPIRE_MINUTES * 60


def get_refresh_token_ttl_seconds() -> int:
    return REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _decode_token(token: str, secret_key: str, expected_type: str) -> str:
    payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
    email: Optional[str] = payload.get("sub")
    token_type: Optional[str] = payload.get("type")
    if not email or token_type != expected_type:
        raise JWTError("Invalid token payload")
    return email


def decode_access_token(token: str) -> str:
    return _decode_token(token, SECRET_KEY, ACCESS_TOKEN_TYPE)


def decode_refresh_token(token: str) -> str:
    return _decode_token(token, REFRESH_SECRET_KEY, REFRESH_TOKEN_TYPE)


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        auth_token = token or request.cookies.get("access_token")
        if not auth_token:
            raise credentials_exception
        email = decode_access_token(auth_token)
    except JWTError:
        raise credentials_exception

    import main

    user = None
    if getattr(main, "db_manager", None):
        user = await main.db_manager.get_user_by_email(email)

    if user is None:
        raise credentials_exception
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Пользователь деактивирован")

    role = user.get("role")
    user["role"] = role if role in ALLOWED_ROLES else ROLE_VIEWER
    return user


def require_roles(*allowed_roles: str) -> Callable:
    normalized_roles = {role.lower() for role in allowed_roles}

    async def _role_guard(current_user=Depends(get_current_user)):
        user_role = str(current_user.get("role", ROLE_VIEWER)).lower()
        if user_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для выполнения операции",
            )
        return current_user

    return _role_guard
