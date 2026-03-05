"""add verification fields to backup_logs

Revision ID: 20260306_000006
Revises: 20260305_000005
Create Date: 2026-03-06 00:35:00

"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260306_000006"
down_revision: Union[str, None] = "20260305_000005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE backup_logs
            ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS verify_status VARCHAR(32),
            ADD COLUMN IF NOT EXISTS verify_log TEXT;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE backup_logs DROP COLUMN IF EXISTS verify_log;")
    op.execute("ALTER TABLE backup_logs DROP COLUMN IF EXISTS verify_status;")
    op.execute("ALTER TABLE backup_logs DROP COLUMN IF EXISTS verified_at;")
