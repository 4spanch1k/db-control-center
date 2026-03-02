from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth_utils import ALLOWED_ROLES, ROLE_ADMIN, require_roles

router = APIRouter()


class UsersListResponse(BaseModel):
    success: bool
    count: int
    data: list[dict]


class RoleUpdateSchema(BaseModel):
    role: str


class ActiveUpdateSchema(BaseModel):
    is_active: bool


class ActionResponse(BaseModel):
    success: bool
    message: str


def _get_db_manager():
    import main

    if not getattr(main, "db_manager", None):
        raise HTTPException(status_code=500, detail="Database manager not initialized")
    return main.db_manager


async def _write_audit(
    actor: dict,
    action: str,
    resource: str,
    status: str,
    details: str | None = None,
) -> None:
    db_manager = _get_db_manager()
    try:
        await db_manager.log_audit_action(
            user_email=actor["email"],
            user_role=actor.get("role", "admin"),
            action=action,
            resource=resource,
            status=status,
            details=details,
        )
    except Exception:
        # Audit should not break primary operation.
        pass


@router.get("/users", response_model=UsersListResponse)
async def list_users(
    limit: int = 200,
    current_user=Depends(require_roles(ROLE_ADMIN)),
):
    db_manager = _get_db_manager()
    rows = await db_manager.list_users(limit=max(1, min(limit, 500)))
    await _write_audit(
        actor=current_user,
        action="users.list",
        resource="users",
        status="success",
        details=f"count={len(rows)}",
    )
    return {"success": True, "count": len(rows), "data": rows}


@router.patch("/users/{user_id}/role", response_model=ActionResponse)
async def update_user_role(
    user_id: str,
    payload: RoleUpdateSchema,
    current_user=Depends(require_roles(ROLE_ADMIN)),
):
    requested_role = payload.role.strip().lower()
    if requested_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Недопустимая роль")

    if str(current_user.get("id")) == user_id and requested_role != ROLE_ADMIN:
        raise HTTPException(status_code=400, detail="Нельзя убрать свою admin-роль")

    db_manager = _get_db_manager()
    updated = await db_manager.update_user_role_by_id(user_id, requested_role)
    if not updated:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    await _write_audit(
        actor=current_user,
        action="users.role_update",
        resource=user_id,
        status="success",
        details=f"role={requested_role}",
    )

    return {"success": True, "message": "Роль пользователя обновлена"}


@router.patch("/users/{user_id}/active", response_model=ActionResponse)
async def update_user_active(
    user_id: str,
    payload: ActiveUpdateSchema,
    current_user=Depends(require_roles(ROLE_ADMIN)),
):
    if str(current_user.get("id")) == user_id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="Нельзя деактивировать самого себя")

    db_manager = _get_db_manager()
    updated = await db_manager.update_user_active_by_id(user_id, payload.is_active)
    if not updated:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    await _write_audit(
        actor=current_user,
        action="users.active_update",
        resource=user_id,
        status="success",
        details=f"is_active={payload.is_active}",
    )

    return {"success": True, "message": "Статус пользователя обновлен"}
