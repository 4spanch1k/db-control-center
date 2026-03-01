from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.security import encrypt_password
from app.core.auth_utils import ROLE_ADMIN, ROLE_OPERATOR, require_roles
from app.services.db_tester import test_postgresql_connection

router = APIRouter()

class ConnectionSchema(BaseModel):
    name: str
    db_type: str
    host: str
    port: int
    username: str
    password: str
    database_name: str | None = None

@router.post("/test")
async def add_connection(
    config: ConnectionSchema,
    current_user=Depends(require_roles(ROLE_ADMIN, ROLE_OPERATOR)),
):
    is_ok, message = await test_postgresql_connection(
        config.host, config.port, config.username, config.password, config.database_name
    )
    
    if not is_ok:
        raise HTTPException(status_code=400, detail=f"Database unreachable: {message}")

    secure_pass = encrypt_password(config.password)
    
    # Import globals from main or use dependency injection.
    import main
    if getattr(main, "db_manager", None):
        await main.db_manager.save_connection(
            config.name, config.db_type, config.host, config.port, config.username, secure_pass, config.database_name
        )
        await main.db_manager.log_audit_action(
            user_email=current_user["email"],
            user_role=current_user.get("role", "viewer"),
            action="connection.test_and_save",
            resource=config.name,
            status="success",
            details=f"{config.db_type}@{config.host}:{config.port}",
        )
    
    return {"status": "success", "message": "Connection verified and saved"}
