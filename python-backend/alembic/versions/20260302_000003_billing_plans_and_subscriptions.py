"""add billing plans and subscriptions

Revision ID: 20260302_000003
Revises: 20260301_000002
Create Date: 2026-03-02 14:45:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260302_000003"
down_revision: Union[str, None] = "20260301_000002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(120) NOT NULL,
            description TEXT,
            role VARCHAR(50) NOT NULL,
            price_monthly_cents INTEGER NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'usd',
            stripe_price_id VARCHAR(255),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT plans_role_check CHECK (role IN ('admin', 'operator', 'viewer'))
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS subscriptions (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            plan_id UUID NOT NULL REFERENCES plans(id),
            status VARCHAR(40) NOT NULL DEFAULT 'inactive',
            provider VARCHAR(30) NOT NULL DEFAULT 'mock',
            provider_customer_id VARCHAR(255),
            provider_subscription_id VARCHAR(255),
            provider_session_id VARCHAR(255),
            cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
            current_period_start TIMESTAMP WITH TIME ZONE,
            current_period_end TIMESTAMP WITH TIME ZONE,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_plans_sort_order
            ON plans(sort_order ASC, created_at ASC);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id
            ON subscriptions(plan_id);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_subscriptions_status
            ON subscriptions(status);
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id
            ON subscriptions(provider, provider_subscription_id)
            WHERE provider_subscription_id IS NOT NULL;
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_session_id
            ON subscriptions(provider, provider_session_id)
            WHERE provider_session_id IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_subscriptions_provider_session_id;")
    op.execute("DROP INDEX IF EXISTS idx_subscriptions_provider_subscription_id;")
    op.execute("DROP INDEX IF EXISTS idx_subscriptions_status;")
    op.execute("DROP INDEX IF EXISTS idx_subscriptions_plan_id;")
    op.execute("DROP INDEX IF EXISTS idx_plans_sort_order;")
    op.execute("DROP TABLE IF EXISTS subscriptions;")
    op.execute("DROP TABLE IF EXISTS plans;")
