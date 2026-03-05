"""retention policy + cleanup runs + backup deleted markers

Revision ID: 20260306_000007
Revises: 20260306_000006
Create Date: 2026-03-06 01:10:00

"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260306_000007"
down_revision: Union[str, None] = "20260306_000006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE backup_logs
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS deleted_reason TEXT;
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_backup_logs_deleted_at
            ON backup_logs(deleted_at DESC);
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS retention_policies (
            id SMALLINT PRIMARY KEY CHECK (id = 1),
            retention_days INTEGER NOT NULL DEFAULT 7,
            retention_copies INTEGER NOT NULL DEFAULT 7,
            cleanup_cron VARCHAR(100) NOT NULL DEFAULT '0 2 * * *',
            is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    op.execute(
        """
        INSERT INTO retention_policies (id, retention_days, retention_copies, cleanup_cron, is_enabled)
        VALUES (1, 7, 7, '0 2 * * *', TRUE)
        ON CONFLICT (id) DO NOTHING;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS retention_cleanup_runs (
            id BIGSERIAL PRIMARY KEY,
            trigger_source VARCHAR(32) NOT NULL,
            retention_days INTEGER NOT NULL,
            retention_copies INTEGER NOT NULL,
            deleted_count INTEGER NOT NULL DEFAULT 0,
            error_count INTEGER NOT NULL DEFAULT 0,
            total_size BIGINT NOT NULL DEFAULT 0,
            reason VARCHAR(255) NOT NULL DEFAULT 'retention',
            status VARCHAR(32) NOT NULL,
            details TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_retention_cleanup_runs_created_at
            ON retention_cleanup_runs(created_at DESC);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_retention_cleanup_runs_created_at;")
    op.execute("DROP TABLE IF EXISTS retention_cleanup_runs;")
    op.execute("DROP TABLE IF EXISTS retention_policies;")
    op.execute("DROP INDEX IF EXISTS idx_backup_logs_deleted_at;")
    op.execute("ALTER TABLE backup_logs DROP COLUMN IF EXISTS deleted_reason;")
    op.execute("ALTER TABLE backup_logs DROP COLUMN IF EXISTS deleted_at;")
