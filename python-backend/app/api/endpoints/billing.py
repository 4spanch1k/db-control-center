import json
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.auth_utils import get_current_user

router = APIRouter()

ROLE_BY_PLAN = {
    "free": "viewer",
    "pro": "operator",
    "max": "admin",
}


def get_default_billing_plans() -> list[dict]:
    return [
        {
            "code": "free",
            "name": "Free",
            "description": "Базовый доступ для просмотра и ознакомления.",
            "role": ROLE_BY_PLAN["free"],
            "price_monthly_cents": 0,
            "currency": "usd",
            "stripe_price_id": None,
            "is_active": True,
            "sort_order": 10,
        },
        {
            "code": "pro",
            "name": "Pro",
            "description": "Для ежедневной работы с инфраструктурой и бэкапами.",
            "role": ROLE_BY_PLAN["pro"],
            "price_monthly_cents": int(os.getenv("BILLING_PRO_MONTHLY_CENTS", "1900")),
            "currency": os.getenv("BILLING_CURRENCY", "usd"),
            "stripe_price_id": os.getenv("STRIPE_PRICE_ID_OPERATOR_MONTHLY", "") or None,
            "is_active": True,
            "sort_order": 20,
        },
        {
            "code": "max",
            "name": "Max",
            "description": "Безлимитный доступ ко всем ручным операциям и максимум возможностей.",
            "role": ROLE_BY_PLAN["max"],
            "price_monthly_cents": int(
                os.getenv("BILLING_MAX_MONTHLY_CENTS", os.getenv("BILLING_TEAM_MONTHLY_CENTS", "7900"))
            ),
            "currency": os.getenv("BILLING_CURRENCY", "usd"),
            "stripe_price_id": (
                os.getenv("STRIPE_PRICE_ID_MAX_MONTHLY", "")
                or os.getenv("STRIPE_PRICE_ID_ADMIN_MONTHLY", "")
                or None
            ),
            "is_active": True,
            "sort_order": 30,
        },
        {
            "code": "team",
            "name": "Team (Legacy)",
            "description": "Legacy plan alias, hidden from active billing list.",
            "role": ROLE_BY_PLAN["max"],
            "price_monthly_cents": int(
                os.getenv("BILLING_MAX_MONTHLY_CENTS", os.getenv("BILLING_TEAM_MONTHLY_CENTS", "7900"))
            ),
            "currency": os.getenv("BILLING_CURRENCY", "usd"),
            "stripe_price_id": (
                os.getenv("STRIPE_PRICE_ID_MAX_MONTHLY", "")
                or os.getenv("STRIPE_PRICE_ID_ADMIN_MONTHLY", "")
                or None
            ),
            "is_active": False,
            "sort_order": 99,
        },
    ]


class BillingPlanResponse(BaseModel):
    code: str
    name: str
    description: str | None = None
    role: str
    price_monthly_cents: int
    currency: str
    is_active: bool


class BillingPlansListResponse(BaseModel):
    success: bool
    count: int
    data: list[BillingPlanResponse]


class SubscriptionInfo(BaseModel):
    status: str
    provider: str
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool
    plan_code: str
    plan_name: str


class BillingCurrentResponse(BaseModel):
    success: bool
    plan_code: str
    current_plan: BillingPlanResponse | None = None
    subscription: SubscriptionInfo | None = None


class CheckoutRequest(BaseModel):
    plan_code: str


class CheckoutResponse(BaseModel):
    success: bool
    provider: str
    status: str
    checkout_url: str | None = None
    message: str


class WebhookResponse(BaseModel):
    success: bool
    message: str


def _get_db_manager():
    import main

    if not getattr(main, "db_manager", None):
        raise HTTPException(status_code=500, detail="Database manager not initialized")
    return main.db_manager


async def _write_audit(user: dict, action: str, status_value: str, details: str | None = None) -> None:
    db_manager = _get_db_manager()
    try:
        await db_manager.log_audit_action(
            user_email=user.get("email", "unknown"),
            user_role=user.get("role", "viewer"),
            action=action,
            resource="billing",
            status=status_value,
            details=details,
        )
    except Exception:
        # audit should not block billing flow
        pass


def _base_url() -> str:
    return os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip("/")


def _normalize_plan(row: dict) -> BillingPlanResponse:
    return BillingPlanResponse(
        code=row["code"],
        name=row["name"],
        description=row.get("description"),
        role=row["role"],
        price_monthly_cents=int(row.get("price_monthly_cents", 0)),
        currency=row.get("currency", "usd"),
        is_active=bool(row.get("is_active", True)),
    )


def _subscription_period_end_default() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=30)


async def _activate_plan_for_user(
    user_id: str,
    plan: dict,
    provider: str,
    provider_session_id: str | None = None,
    provider_customer_id: str | None = None,
    provider_subscription_id: str | None = None,
    current_period_end: datetime | None = None,
) -> None:
    db_manager = _get_db_manager()
    now = datetime.now(timezone.utc)
    await db_manager.upsert_subscription_for_user(
        user_id=user_id,
        plan_id=str(plan["id"]),
        status="active",
        provider=provider,
        provider_customer_id=provider_customer_id,
        provider_subscription_id=provider_subscription_id,
        provider_session_id=provider_session_id,
        cancel_at_period_end=False,
        current_period_start=now,
        current_period_end=current_period_end or _subscription_period_end_default(),
        ended_at=None,
    )
    updated = await db_manager.update_user_role_by_id(user_id, plan["role"])
    if not updated:
        raise HTTPException(status_code=404, detail="Пользователь не найден")


def _billing_provider() -> str:
    return os.getenv("BILLING_PROVIDER", "mock").strip().lower() or "mock"


def _load_stripe():
    secret = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Stripe не настроен: отсутствует STRIPE_SECRET_KEY",
        )
    try:
        import stripe  # type: ignore
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Пакет stripe не установлен. Добавьте зависимость и перезапустите сервис.",
        ) from exc

    stripe.api_key = secret
    return stripe


@router.get("/billing/plans", response_model=BillingPlansListResponse)
async def list_billing_plans(_=Depends(get_current_user)):
    db_manager = _get_db_manager()
    rows = await db_manager.get_billing_plans(only_active=True)
    data = [_normalize_plan(row) for row in rows]
    return BillingPlansListResponse(success=True, count=len(data), data=data)


@router.get("/billing/current", response_model=BillingCurrentResponse)
async def get_current_billing(current_user=Depends(get_current_user)):
    db_manager = _get_db_manager()

    plans = await db_manager.get_billing_plans(only_active=True)
    subscription_row = await db_manager.get_current_subscription(str(current_user["id"]))
    if subscription_row and str(subscription_row.get("status", "")).lower() == "active":
        current_plan_code = str(subscription_row.get("plan_code", "free")).lower()
        current_plan = next((plan for plan in plans if plan["code"] == current_plan_code), None)
    else:
        current_plan_code = "free"
        current_plan = next((plan for plan in plans if plan["code"] == "free"), None)

    if subscription_row:
        subscription = SubscriptionInfo(
            status=subscription_row["status"],
            provider=subscription_row["provider"],
            current_period_start=subscription_row.get("current_period_start"),
            current_period_end=subscription_row.get("current_period_end"),
            cancel_at_period_end=bool(subscription_row.get("cancel_at_period_end", False)),
            plan_code=subscription_row["plan_code"],
            plan_name=subscription_row["plan_name"],
        )
    else:
        subscription = None

    return BillingCurrentResponse(
        success=True,
        plan_code=current_plan_code,
        current_plan=_normalize_plan(current_plan) if current_plan else None,
        subscription=subscription,
    )


@router.post("/billing/checkout", response_model=CheckoutResponse)
async def create_checkout_session(payload: CheckoutRequest, current_user=Depends(get_current_user)):
    db_manager = _get_db_manager()
    plan_code = payload.plan_code.strip().lower()
    plan = await db_manager.get_billing_plan_by_code(plan_code)
    if not plan or not plan.get("is_active", True):
        raise HTTPException(status_code=404, detail="Тариф не найден")

    user_id = str(current_user["id"])
    user_email = current_user["email"]
    provider = _billing_provider()

    if plan_code == "free":
        await _activate_plan_for_user(user_id=user_id, plan=plan, provider="system")
        await _write_audit(
            current_user,
            action="billing.downgrade",
            status_value="success",
            details="plan=free",
        )
        return CheckoutResponse(
            success=True,
            provider="system",
            status="active",
            checkout_url=f"{_base_url()}/billing?status=free",
            message="План Free активирован",
        )

    if provider == "mock":
        await _activate_plan_for_user(user_id=user_id, plan=plan, provider="mock")
        await _write_audit(
            current_user,
            action="billing.mock_activate",
            status_value="success",
            details=f"plan={plan_code}",
        )
        return CheckoutResponse(
            success=True,
            provider="mock",
            status="active",
            checkout_url=f"{_base_url()}/billing?status=success&provider=mock&plan={plan_code}",
            message="Mock-подписка активирована",
        )

    stripe = _load_stripe()
    if not plan.get("stripe_price_id"):
        raise HTTPException(
            status_code=400,
            detail=f"Для плана {plan_code} не указан stripe_price_id",
        )

    success_url = f"{_base_url()}/billing?status=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{_base_url()}/billing?status=cancel"

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": plan["stripe_price_id"], "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        client_reference_id=user_id,
        customer_email=user_email,
        metadata={
            "user_id": user_id,
            "user_email": user_email,
            "plan_code": plan_code,
        },
    )

    await db_manager.upsert_subscription_for_user(
        user_id=user_id,
        plan_id=str(plan["id"]),
        status="pending_checkout",
        provider="stripe",
        provider_customer_id=session.get("customer"),
        provider_subscription_id=session.get("subscription"),
        provider_session_id=session["id"],
        cancel_at_period_end=False,
        current_period_start=None,
        current_period_end=None,
        ended_at=None,
    )
    await _write_audit(
        current_user,
        action="billing.checkout_created",
        status_value="success",
        details=f"plan={plan_code}, session={session['id']}",
    )

    return CheckoutResponse(
        success=True,
        provider="stripe",
        status="pending_checkout",
        checkout_url=session.url,
        message="Checkout session создана",
    )


@router.post("/billing/webhook", response_model=WebhookResponse)
async def billing_webhook(request: Request):
    db_manager = _get_db_manager()
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    provider = _billing_provider()

    if provider != "stripe":
        return WebhookResponse(success=True, message="Webhook ignored for non-stripe provider")

    stripe = _load_stripe()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload=payload, sig_header=signature, secret=webhook_secret)
        else:
            event = json.loads(payload.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Webhook signature error: {exc}")

    event_type = event.get("type", "")
    data_object = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        metadata = data_object.get("metadata", {}) or {}
        user_id = metadata.get("user_id")
        plan_code = (metadata.get("plan_code") or "").lower()
        if user_id and plan_code:
            plan = await db_manager.get_billing_plan_by_code(plan_code)
            if plan:
                await _activate_plan_for_user(
                    user_id=user_id,
                    plan=plan,
                    provider="stripe",
                    provider_session_id=data_object.get("id"),
                    provider_customer_id=data_object.get("customer"),
                    provider_subscription_id=data_object.get("subscription"),
                )

    if event_type == "customer.subscription.deleted":
        provider_subscription_id = data_object.get("id")
        if provider_subscription_id:
            user_id = await db_manager.get_user_id_by_subscription_provider_id(
                provider="stripe",
                provider_subscription_id=provider_subscription_id,
            )
            if user_id:
                free_plan = await db_manager.get_billing_plan_by_code("free")
                if free_plan:
                    await db_manager.upsert_subscription_for_user(
                        user_id=user_id,
                        plan_id=str(free_plan["id"]),
                        status="canceled",
                        provider="stripe",
                        provider_customer_id=data_object.get("customer"),
                        provider_subscription_id=provider_subscription_id,
                        provider_session_id=None,
                        cancel_at_period_end=bool(data_object.get("cancel_at_period_end", False)),
                        current_period_start=None,
                        current_period_end=None,
                        ended_at=datetime.now(timezone.utc),
                    )
                    await db_manager.update_user_role_by_id(user_id, free_plan["role"])

    return WebhookResponse(success=True, message="Webhook processed")
