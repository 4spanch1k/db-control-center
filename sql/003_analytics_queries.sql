-- =====================================================
-- 003_analytics_queries.sql
-- SQL-запросы для сбора аналитических данных
-- =====================================================

-- 1. Получение последних 30 записей аналитики для построения графиков
-- Используется для отображения тренда
-- USAGE: SELECT * FROM get_analytics_recent_30();
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

-- 2. Получение последней записи аналитики (текущее состояние)
-- USAGE: SELECT * FROM get_analytics_current();
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

-- 3. Получение статистики по времени (за день, неделю, месяц)
-- USAGE: SELECT * FROM get_analytics_statistic('1 day');
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
        CEIL(AVG(a.total_backups_size))::BIGINT as avg_backups_size,
        MAX(a.total_backups_size) as max_backups_size,
        MIN(a.total_backups_size) as min_backups_size,
        ROUND(AVG(a.backups_count), 2) as avg_backups_count,
        MAX(a.backups_count) as max_backups_count,
        MIN(a.backups_count) as min_backups_count,
        ROUND(AVG(a.active_connections), 2) as avg_active_connections,
        MAX(a.active_connections) as max_active_connections,
        MIN(a.active_connections) as min_active_connections,
        COUNT(*)::INTEGER as records_count
    FROM analytics_stats a
    WHERE a.timestamp > NOW() - period;
END;
$$ LANGUAGE plpgsql;

-- 4. Получение информации о состоянии базы данных
-- Собирает данные из system catalogs
-- USAGE: SELECT * FROM get_database_health_info();
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
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::INTEGER,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle')::INTEGER,
        (SELECT count(*) FROM pg_stat_activity)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- 5. Получение размеров индексов
-- USAGE: SELECT * FROM get_indexes_info();
CREATE OR REPLACE FUNCTION get_indexes_info()
RETURNS TABLE (
    index_name VARCHAR,
    table_name VARCHAR,
    index_size_bytes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.indexname::VARCHAR,
        t.tablename::VARCHAR,
        pg_relation_size(i.indexrelid)::BIGINT
    FROM pg_indexes i
    JOIN pg_tables t ON i.tablename = t.tablename
    WHERE i.schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY pg_relation_size(i.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. Расчет сэкономленного места и дельта
-- USAGE: SELECT * FROM get_analytics_delta();
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
    -- Получаем текущий размер всех бэкапов
    SELECT total_backups_size INTO v_current_size
    FROM analytics_stats
    ORDER BY timestamp DESC
    LIMIT 1;

    -- Получаем сэкономленное место
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

-- 7. Инструкция для вставки новых данных аналитики
-- USAGE: SELECT insert_analytics_stats(total_size, backup_count, tables_count, indexes_size, connections);
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

-- 8. Получение сводной информации для дашборда
-- USAGE: SELECT * FROM get_dashboard_summary();
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
