import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main
from app.api.endpoints.auth import router as auth_router
from app.core.auth_utils import create_access_token, hash_password, get_current_user


class AuthFlowTests(unittest.TestCase):
    def setUp(self):
        self._original_db = backend_main.db_manager

        self.user = {
            "id": "test-id",
            "email": "admin@example.com",
            "hashed_password": hash_password("StrongPass123!"),
            "is_active": True,
        }

        async def _get_user_by_email(email: str):
            if email == self.user["email"]:
                return self.user
            return None

        self.db_manager = SimpleNamespace(
            get_user_by_email=AsyncMock(side_effect=_get_user_by_email),
        )

        backend_main.db_manager = self.db_manager

        app = FastAPI()
        app.include_router(auth_router, prefix="/api")

        @app.get("/protected")
        async def protected_route(current_user=Depends(get_current_user)):
            return {"email": current_user["email"]}

        self.client = TestClient(app)

    def tearDown(self):
        backend_main.db_manager = self._original_db

    def test_login_sets_auth_cookies(self):
        response = self.client.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": "StrongPass123!"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["token_type"], "bearer")
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)
        self.assertIn("HttpOnly", response.headers.get("set-cookie", ""))

    def test_login_invalid_credentials_returns_401(self):
        response = self.client.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": "WrongPassword"},
        )

        self.assertEqual(response.status_code, 401)

    def test_refresh_rotates_tokens(self):
        login_response = self.client.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": "StrongPass123!"},
        )
        self.assertEqual(login_response.status_code, 200)

        first_access_token = login_response.cookies.get("access_token")
        first_refresh_token = login_response.cookies.get("refresh_token")

        refresh_response = self.client.post("/api/auth/refresh")
        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access_token", refresh_response.cookies)
        self.assertIn("refresh_token", refresh_response.cookies)

        self.assertNotEqual(first_access_token, refresh_response.cookies.get("access_token"))
        self.assertNotEqual(first_refresh_token, refresh_response.cookies.get("refresh_token"))

    def test_refresh_without_cookie_returns_401(self):
        client = TestClient(self.client.app)
        response = client.post("/api/auth/refresh")
        self.assertEqual(response.status_code, 401)

    def test_logout_clears_cookies(self):
        self.client.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": "StrongPass123!"},
        )

        response = self.client.post("/api/auth/logout")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertIn("Max-Age=0", response.headers.get("set-cookie", ""))

    def test_protected_endpoint_accepts_access_token_cookie(self):
        access_token = create_access_token({"sub": self.user["email"]})
        self.client.cookies.set("access_token", access_token)

        response = self.client.get("/protected")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], self.user["email"])


if __name__ == "__main__":
    unittest.main()
