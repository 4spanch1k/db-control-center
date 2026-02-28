from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.auth_utils import verify_password, create_access_token

router = APIRouter()

class LoginSchema(BaseModel):
    email: str
    password: str

@router.post("/auth/login")
async def login(credentials: LoginSchema):
    import main
    if getattr(main, "db_manager", None):
        user = await main.db_manager.get_user_by_email(credentials.email)
        if not user or not verify_password(credentials.password, user['hashed_password']):
            raise HTTPException(status_code=401, detail="Неверная почта или пароль")
        
        token = create_access_token(data={"sub": user['email']})
        return {"access_token": token, "token_type": "bearer"}
    else:
        raise HTTPException(status_code=500, detail="Database manager not initialized")
