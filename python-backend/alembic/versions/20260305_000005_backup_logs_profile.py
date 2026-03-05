"""add profile_id and profile_meta to backup_logs

Revision ID: 20260305_000005
Revises: 20260305_000004
Create Date: 2026-03-05 23:44:00

"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260305_000005"
down_revision: Union[str, None] = "20260305_000004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add profile_id (nullable FK) and profile_meta (jsonb) to backup_logs
    op.execute(
        """
        ALTER TABLE backup_logs
            ADD COLUMN IF NOT EXISTS profile_id UUID
                REFERENCES backup_profiles(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS profile_meta JSONB DEFAULT '{}'::jsonb;
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_backup_logs_profile_id
            ON backup_logs(profile_id);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_backup_logs_profile_id;")
    op.execute("ALTER TABLE backup_logs DROP COLUMN IF EXISTS profile_meta;")
    op.execute("ALTER TABLE backup_logs DROP COLUMN IF EXISTS profile_id;")
