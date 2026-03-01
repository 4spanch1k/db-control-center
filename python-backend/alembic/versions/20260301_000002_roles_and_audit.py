"""add roles and audit logs

Revision ID: 20260301_000002
Revises: 20260301_000001
Create Date: 2026-03-01 22:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260301_000002"
down_revision: Union[str, None] = "20260301_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(50);
        """
    )

    op.execute(
        """
        UPDATE users
        SET role = 'viewer'
        WHERE role IS NULL;
        """
    )

    op.execute(
        """
        UPDATE users
        SET role = 'admin'
        WHERE email = 'admin@example.com';
        """
    )

    op.execute(
        """
        ALTER TABLE users
        ALTER COLUMN role SET DEFAULT 'viewer';
        """
    )

    op.execute(
        """
        ALTER TABLE users
        ALTER COLUMN role SET NOT NULL;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'users_role_check'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT users_role_check
                CHECK (role IN ('admin', 'operator', 'viewer'));
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id BIGSERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            user_role VARCHAR(50) NOT NULL,
            action VARCHAR(120) NOT NULL,
            resource VARCHAR(255) NOT NULL,
            status VARCHAR(30) NOT NULL,
            details TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
            ON audit_logs(created_at DESC);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email
            ON audit_logs(user_email);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_audit_logs_user_email;")
    op.execute("DROP INDEX IF EXISTS idx_audit_logs_created_at;")
    op.execute("DROP TABLE IF EXISTS audit_logs;")

    op.execute(
        """
        ALTER TABLE users
        DROP CONSTRAINT IF EXISTS users_role_check;
        """
    )
    op.execute(
        """
        ALTER TABLE users
        DROP COLUMN IF EXISTS role;
        """
    )
