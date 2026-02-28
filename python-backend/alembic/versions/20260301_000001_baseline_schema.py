"""baseline schema

Revision ID: 20260301_000001
Revises:
Create Date: 2026-03-01 00:00:01

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260301_000001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS connections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            db_type VARCHAR(50) NOT NULL,
            host VARCHAR(255) NOT NULL,
            port INTEGER NOT NULL,
            username VARCHAR(255) NOT NULL,
            encrypted_password TEXT NOT NULL,
            database_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            last_check_status BOOLEAN,
            last_check_at TIMESTAMP
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW()
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS backup_logs (
            id SERIAL PRIMARY KEY,
            action VARCHAR(50) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            size_bytes BIGINT NOT NULL,
            status VARCHAR(50) NOT NULL,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS analytics_stats (
            id BIGSERIAL PRIMARY KEY,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            total_backups_size BIGINT NOT NULL DEFAULT 0,
            backups_count INTEGER NOT NULL DEFAULT 0,
            db_tables_count INTEGER NOT NULL DEFAULT 0,
            indexes_size BIGINT NOT NULL DEFAULT 0,
            active_connections INTEGER NOT NULL DEFAULT 0,
            db_size BIGINT DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS backup_deletion_logs (
            id BIGSERIAL PRIMARY KEY,
            backup_key VARCHAR(500) NOT NULL,
            deleted_size BIGINT NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            reason VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_analytics_stats_timestamp
            ON analytics_stats(timestamp DESC);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_backup_deletion_logs_deleted_at
            ON backup_deletion_logs(deleted_at DESC);
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_analytics_stats_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS trigger_analytics_stats_updated_at ON analytics_stats;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trigger_analytics_stats_updated_at
            BEFORE UPDATE ON analytics_stats
            FOR EACH ROW
            EXECUTE FUNCTION update_analytics_stats_updated_at();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW analytics_saved_space AS
        SELECT
            COALESCE(SUM(deleted_size), 0) AS total_saved_space,
            COUNT(*) AS total_deleted_backups,
            MAX(deleted_at) AS last_deletion_time
        FROM backup_deletion_logs;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION get_analytics_recent_30()
        RETURNS TABLE (
            id BIGINT,
            "timestamp" TIMESTAMP WITH TIME ZONE,
            total_backups_size BIGINT,
            backups_count INTEGER,
            db_tables_count INTEGER,
            indexes_size BIGINT,
            active_connections INTEGER,
            db_size BIGINT
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                a.id,
                a.timestamp,
                a.total_backups_size,
                a.backups_count,
                a.db_tables_count,
                a.indexes_size,
                a.active_connections,
                a.db_size
            FROM analytics_stats a
            ORDER BY a.timestamp DESC
            LIMIT 30;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION get_analytics_current()
        RETURNS TABLE (
            id BIGINT,
            "timestamp" TIMESTAMP WITH TIME ZONE,
            total_backups_size BIGINT,
            backups_count INTEGER,
            db_tables_count INTEGER,
            indexes_size BIGINT,
            active_connections INTEGER,
            db_size BIGINT
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                a.id,
                a.timestamp,
                a.total_backups_size,
                a.backups_count,
                a.db_tables_count,
                a.indexes_size,
                a.active_connections,
                a.db_size
            FROM analytics_stats a
            ORDER BY a.timestamp DESC
            LIMIT 1;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION get_analytics_statistic(period INTERVAL)
        RETURNS TABLE (
            avg_backups_size BIGINT,
            max_backups_size BIGINT,
            min_backups_size BIGINT,
            avg_backups_count NUMERIC,
            max_backups_count INTEGER,
            min_backups_count INTEGER,
            avg_active_connections NUMERIC,
            max_active_connections INTEGER,
            min_active_connections INTEGER,
            records_count INTEGER
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                CEIL(AVG(a.total_backups_size))::BIGINT,
                MAX(a.total_backups_size),
                MIN(a.total_backups_size),
                ROUND(AVG(a.backups_count), 2),
                MAX(a.backups_count),
                MIN(a.backups_count),
                ROUND(AVG(a.active_connections), 2),
                MAX(a.active_connections),
                MIN(a.active_connections),
                COUNT(*)::INTEGER
            FROM analytics_stats a
            WHERE a.timestamp > NOW() - period;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION get_database_health_info()
        RETURNS TABLE (
            db_tables_count BIGINT,
            db_indexes_count BIGINT,
            db_size_bytes BIGINT,
            active_connections INTEGER,
            idle_connections INTEGER,
            total_connections INTEGER
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                (SELECT COUNT(*) FROM information_schema.tables
                 WHERE table_schema NOT IN ('pg_catalog', 'information_schema'))::BIGINT,
                (SELECT COUNT(*) FROM pg_indexes
                 WHERE schemaname NOT IN ('pg_catalog', 'information_schema'))::BIGINT,
                pg_database_size(current_database())::BIGINT,
                (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active')::INTEGER,
                (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle')::INTEGER,
                (SELECT COUNT(*) FROM pg_stat_activity)::INTEGER;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION get_indexes_info()
        RETURNS TABLE (
            index_name VARCHAR,
            table_name VARCHAR,
            index_size_bytes BIGINT
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                i.relname::VARCHAR AS index_name,
                t.relname::VARCHAR AS table_name,
                pg_relation_size(i.oid)::BIGINT AS index_size_bytes
            FROM pg_class i
            JOIN pg_index ix ON ix.indexrelid = i.oid
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE i.relkind = 'i'
              AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY pg_relation_size(i.oid) DESC;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION get_analytics_delta()
        RETURNS TABLE (
            current_backups_size BIGINT,
            saved_space BIGINT,
            total_ever_stored BIGINT,
            space_efficiency_percent NUMERIC
        ) AS $$
        DECLARE
            v_current_size BIGINT;
            v_saved_space BIGINT;
        BEGIN
            SELECT total_backups_size INTO v_current_size
            FROM analytics_stats
            ORDER BY timestamp DESC
            LIMIT 1;

            SELECT total_saved_space INTO v_saved_space
            FROM analytics_saved_space;

            v_current_size := COALESCE(v_current_size, 0);
            v_saved_space := COALESCE(v_saved_space, 0);

            RETURN QUERY
            SELECT
                v_current_size,
                v_saved_space,
                v_current_size + v_saved_space,
                ROUND(
                    CASE
                        WHEN (v_current_size + v_saved_space) > 0
                        THEN (v_saved_space::NUMERIC / (v_current_size + v_saved_space)::NUMERIC) * 100
                        ELSE 0
                    END,
                    2
                );
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION insert_analytics_stats(
            p_total_backups_size BIGINT,
            p_backups_count INTEGER,
            p_db_tables_count INTEGER,
            p_indexes_size BIGINT,
            p_active_connections INTEGER,
            p_db_size BIGINT DEFAULT 0
        )
        RETURNS BIGINT AS $$
        DECLARE
            v_id BIGINT;
        BEGIN
            INSERT INTO analytics_stats (
                total_backups_size,
                backups_count,
                db_tables_count,
                indexes_size,
                active_connections,
                db_size
            ) VALUES (
                p_total_backups_size,
                p_backups_count,
                p_db_tables_count,
                p_indexes_size,
                p_active_connections,
                p_db_size
            )
            RETURNING id INTO v_id;

            RETURN v_id;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION get_dashboard_summary()
        RETURNS TABLE (
            current_backups_count INTEGER,
            current_backups_size BIGINT,
            total_saved_space BIGINT,
            db_tables BIGINT,
            active_connections INTEGER,
            db_health_score NUMERIC,
            last_update TIMESTAMP WITH TIME ZONE
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                a.backups_count::INTEGER,
                a.total_backups_size::BIGINT,
                COALESCE((SELECT s.total_saved_space FROM analytics_saved_space s), 0::BIGINT)::BIGINT,
                a.db_tables_count::BIGINT,
                a.active_connections::INTEGER,
                ROUND(
                    (CASE
                        WHEN a.active_connections <= 10 THEN 100
                        WHEN a.active_connections <= 50 THEN 80
                        WHEN a.active_connections <= 100 THEN 60
                        ELSE 40
                    END)::NUMERIC, 1
                )::NUMERIC,
                a.timestamp::TIMESTAMP WITH TIME ZONE
            FROM analytics_stats a
            ORDER BY a.timestamp DESC
            LIMIT 1;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS get_dashboard_summary();")
    op.execute("DROP FUNCTION IF EXISTS insert_analytics_stats(BIGINT, INTEGER, INTEGER, BIGINT, INTEGER, BIGINT);")
    op.execute("DROP FUNCTION IF EXISTS get_analytics_delta();")
    op.execute("DROP FUNCTION IF EXISTS get_indexes_info();")
    op.execute("DROP FUNCTION IF EXISTS get_database_health_info();")
    op.execute("DROP FUNCTION IF EXISTS get_analytics_statistic(INTERVAL);")
    op.execute("DROP FUNCTION IF EXISTS get_analytics_current();")
    op.execute("DROP FUNCTION IF EXISTS get_analytics_recent_30();")

    op.execute("DROP VIEW IF EXISTS analytics_saved_space;")

    op.execute("DROP TRIGGER IF EXISTS trigger_analytics_stats_updated_at ON analytics_stats;")
    op.execute("DROP FUNCTION IF EXISTS update_analytics_stats_updated_at();")

    op.execute("DROP TABLE IF EXISTS backup_deletion_logs;")
    op.execute("DROP TABLE IF EXISTS analytics_stats;")
    op.execute("DROP TABLE IF EXISTS backup_logs;")
    op.execute("DROP TABLE IF EXISTS users;")
    op.execute("DROP TABLE IF EXISTS connections;")
