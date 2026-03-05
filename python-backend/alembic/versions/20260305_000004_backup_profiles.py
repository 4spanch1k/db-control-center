"""backup_profiles

Revision ID: 20260305_000004
Revises: 20260302_000003
Create Date: 2026-03-05 23:38:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260305_000004"
down_revision: Union[str, None] = "20260302_000003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enum types ──
    op.execute("CREATE TYPE backup_mode AS ENUM ('full', 'custom');")
    op.execute("CREATE TYPE data_mode AS ENUM ('schema_and_data', 'schema_only');")

    # ── Table ──
    op.execute(
        """
        CREATE TABLE backup_profiles (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            connection_id   UUID NOT NULL
                            REFERENCES connections(id) ON DELETE CASCADE,
            name            VARCHAR(255) NOT NULL,
            mode            backup_mode NOT NULL DEFAULT 'full',
            include_schemas JSONB NOT NULL DEFAULT '[]'::jsonb,
            include_tables  JSONB NOT NULL DEFAULT '[]'::jsonb,
            exclude_schemas JSONB NOT NULL DEFAULT '[]'::jsonb,
            exclude_tables  JSONB NOT NULL DEFAULT '[]'::jsonb,
            data_mode       data_mode NOT NULL DEFAULT 'schema_and_data',
            is_default      BOOLEAN NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )

    # ── Indexes ──
    op.execute(
        """
        CREATE INDEX idx_backup_profiles_connection
            ON backup_profiles(connection_id);
        """
    )

    # Only one default per connection
    op.execute(
        """
        CREATE UNIQUE INDEX uq_backup_profiles_default
            ON backup_profiles(connection_id)
            WHERE is_default = TRUE;
        """
    )

    # ── updated_at trigger ──
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_backup_profiles_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trigger_backup_profiles_updated_at
            BEFORE UPDATE ON backup_profiles
            FOR EACH ROW
            EXECUTE FUNCTION update_backup_profiles_updated_at();
        """
    )

    # ── Create default profile for every existing connection ──
    op.execute(
        """
        INSERT INTO backup_profiles (connection_id, name, mode, is_default)
        SELECT id, 'Full backup', 'full', TRUE
        FROM connections
        ON CONFLICT DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trigger_backup_profiles_updated_at ON backup_profiles;")
    op.execute("DROP FUNCTION IF EXISTS update_backup_profiles_updated_at();")
    op.execute("DROP TABLE IF EXISTS backup_profiles;")
    op.execute("DROP TYPE IF EXISTS data_mode;")
    op.execute("DROP TYPE IF EXISTS backup_mode;")
