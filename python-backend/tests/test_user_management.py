import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.users import router as users_router
from app.core.auth_utils import ROLE_ADMIN, ROLE_VIEWER, create_access_token, hash_password


class UserManagementTests(unittest.TestCase):
    def setUp(self):
        self._original_db = backend_main.db_manager

        self.admin_user = {
            "id": "00000000-0000-0000-0000-000000000001",
            "email": "admin@example.com",
            "hashed_password": hash_password("StrongPass123!"),
            "is_active": True,
            "role": ROLE_ADMIN,
        }
        self.viewer_user = {
            "id": "00000000-0000-0000-0000-000000000002",
            "email": "viewer@example.com",
            "hashed_password": hash_password("StrongPass123!"),
            "is_active": True,
            "role": ROLE_VIEWER,
        }
        self.users_by_email = {
            self.admin_user["email"]: self.admin_user,
            self.viewer_user["email"]: self.viewer_user,
        }

        async def _get_user_by_email(email: str):
            return self.users_by_email.get(email)

        async def _list_users(limit: int = 200):
            users = [self.admin_user, self.viewer_user][:limit]
            return [
                {
                    "id": user["id"],
                    "email": user["email"],
                    "role": user["role"],
                    "is_active": user["is_active"],
                    "created_at": "2026-03-01T00:00:00Z",
                }
                for user in users
            ]

        async def _update_user_role_by_id(user_id: str, role: str):
            if user_id == self.viewer_user["id"]:
                self.viewer_user["role"] = role
                return True
            return False

        async def _update_user_active_by_id(user_id: str, is_active: bool):
            if user_id == self.viewer_user["id"]:
                self.viewer_user["is_active"] = is_active
                return True
            return False

        self.db_manager = SimpleNamespace(
            get_user_by_email=AsyncMock(side_effect=_get_user_by_email),
            list_users=AsyncMock(side_effect=_list_users),
            update_user_role_by_id=AsyncMock(side_effect=_update_user_role_by_id),
            update_user_active_by_id=AsyncMock(side_effect=_update_user_active_by_id),
            log_audit_action=AsyncMock(),
        )
        backend_main.db_manager = self.db_manager

        app = FastAPI()
        app.include_router(auth_router, prefix="/api")
        app.include_router(users_router, prefix="/api")
        self.client = TestClient(app)

    def tearDown(self):
        backend_main.db_manager = self._original_db

    def _set_auth_cookie(self, email: str):
        token = create_access_token({"sub": email})
        self.client.cookies.set("access_token", token)

    def test_admin_can_list_users(self):
        self._set_auth_cookie("admin@example.com")
        response = self.client.get("/api/users")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["count"], 2)

    def test_viewer_cannot_list_users(self):
        self._set_auth_cookie("viewer@example.com")
        response = self.client.get("/api/users")
        self.assertEqual(response.status_code, 403)

    def test_admin_can_update_user_role(self):
        self._set_auth_cookie("admin@example.com")
        response = self.client.patch(
            f"/api/users/{self.viewer_user['id']}/role",
            json={"role": "operator"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.viewer_user["role"], "operator")

    def test_admin_cannot_remove_own_admin_role(self):
        self._set_auth_cookie("admin@example.com")
        response = self.client.patch(
            f"/api/users/{self.admin_user['id']}/role",
            json={"role": "viewer"},
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_can_deactivate_other_user(self):
        self._set_auth_cookie("admin@example.com")
        response = self.client.patch(
            f"/api/users/{self.viewer_user['id']}/active",
            json={"is_active": False},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.viewer_user["is_active"])

    def test_admin_cannot_deactivate_self(self):
        self._set_auth_cookie("admin@example.com")
        response = self.client.patch(
            f"/api/users/{self.admin_user['id']}/active",
            json={"is_active": False},
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
