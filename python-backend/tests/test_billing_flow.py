import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.billing import router as billing_router
from app.core.auth_utils import create_access_token, hash_password


class BillingFlowTests(unittest.TestCase):
    def setUp(self):
        self._original_db = backend_main.db_manager

        self.user = {
            "id": "00000000-0000-0000-0000-000000000011",
            "email": "user@example.com",
            "hashed_password": hash_password("StrongPass123!"),
            "is_active": True,
            "role": "viewer",
        }
        self.users_by_email = {self.user["email"]: self.user}

        self.plans = [
            {
                "id": "00000000-0000-0000-0000-000000000101",
                "code": "free",
                "name": "Free",
                "description": "Free plan",
                "role": "viewer",
                "price_monthly_cents": 0,
                "currency": "usd",
                "stripe_price_id": None,
                "is_active": True,
                "sort_order": 10,
            },
            {
                "id": "00000000-0000-0000-0000-000000000102",
                "code": "pro",
                "name": "Pro",
                "description": "Pro plan",
                "role": "operator",
                "price_monthly_cents": 1900,
                "currency": "usd",
                "stripe_price_id": None,
                "is_active": True,
                "sort_order": 20,
            },
        ]
        self.subscriptions: dict[str, dict] = {}

        async def _get_user_by_email(email: str):
            return self.users_by_email.get(email)

        async def _get_billing_plans(only_active: bool = True):
            if only_active:
                return [plan for plan in self.plans if plan["is_active"]]
            return list(self.plans)

        async def _get_billing_plan_by_code(code: str):
            for plan in self.plans:
                if plan["code"] == code:
                    return plan
            return None

        async def _get_current_subscription(user_id: str):
            return self.subscriptions.get(user_id)

        async def _upsert_subscription_for_user(
            user_id: str,
            plan_id: str,
            status: str,
            provider: str,
            provider_customer_id=None,
            provider_subscription_id=None,
            provider_session_id=None,
            cancel_at_period_end=False,
            current_period_start=None,
            current_period_end=None,
            ended_at=None,
        ):
            selected_plan = next(plan for plan in self.plans if plan["id"] == plan_id)
            self.subscriptions[user_id] = {
                "user_id": user_id,
                "plan_id": plan_id,
                "status": status,
                "provider": provider,
                "provider_customer_id": provider_customer_id,
                "provider_subscription_id": provider_subscription_id,
                "provider_session_id": provider_session_id,
                "cancel_at_period_end": cancel_at_period_end,
                "current_period_start": current_period_start,
                "current_period_end": current_period_end,
                "plan_code": selected_plan["code"],
                "plan_name": selected_plan["name"],
                "plan_role": selected_plan["role"],
                "price_monthly_cents": selected_plan["price_monthly_cents"],
                "currency": selected_plan["currency"],
            }
            return True

        async def _update_user_role_by_id(user_id: str, role: str):
            if self.user["id"] == user_id:
                self.user["role"] = role
                return True
            return False

        self.db_manager = SimpleNamespace(
            get_user_by_email=AsyncMock(side_effect=_get_user_by_email),
            get_billing_plans=AsyncMock(side_effect=_get_billing_plans),
            get_billing_plan_by_code=AsyncMock(side_effect=_get_billing_plan_by_code),
            get_current_subscription=AsyncMock(side_effect=_get_current_subscription),
            upsert_subscription_for_user=AsyncMock(side_effect=_upsert_subscription_for_user),
            update_user_role_by_id=AsyncMock(side_effect=_update_user_role_by_id),
            log_audit_action=AsyncMock(),
        )
        backend_main.db_manager = self.db_manager

        app = FastAPI()
        app.include_router(auth_router, prefix="/api")
        app.include_router(billing_router, prefix="/api")
        self.client = TestClient(app)

    def tearDown(self):
        backend_main.db_manager = self._original_db

    def _set_auth_cookie(self, email: str):
        token = create_access_token({"sub": email})
        self.client.cookies.set("access_token", token)

    def test_get_billing_current_for_authenticated_user(self):
        self._set_auth_cookie(self.user["email"])
        response = self.client.get("/api/billing/current")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["role"], "viewer")
        self.assertEqual(payload["current_plan"]["code"], "free")

    def test_mock_checkout_activates_pro_plan_and_role(self):
        self._set_auth_cookie(self.user["email"])
        with patch.dict(os.environ, {"BILLING_PROVIDER": "mock"}, clear=False):
            response = self.client.post("/api/billing/checkout", json={"plan_code": "pro"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["provider"], "mock")
        self.assertEqual(payload["status"], "active")
        self.assertEqual(self.user["role"], "operator")
        self.assertIn(self.user["id"], self.subscriptions)
        self.assertEqual(self.subscriptions[self.user["id"]]["plan_code"], "pro")


if __name__ == "__main__":
    unittest.main()
