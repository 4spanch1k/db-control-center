-- =====================================================
-- 001_create_analytics_stats_table.sql
-- Создание таблицы для хранения аналитических данных
-- =====================================================

-- Создаем таблицу для хранения статистики
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

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_analytics_stats_timestamp 
    ON analytics_stats(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_stats_created_at 
    ON analytics_stats(created_at DESC);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_analytics_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_analytics_stats_updated_at ON analytics_stats;
CREATE TRIGGER trigger_analytics_stats_updated_at
    BEFORE UPDATE ON analytics_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_stats_updated_at();

-- Комментарии для документации
COMMENT ON TABLE analytics_stats IS 'Таблица для хранения аналитических данных о состоянии БД и бэкапов';
COMMENT ON COLUMN analytics_stats.total_backups_size IS 'Общий размер всех бэкапов в хранилище (S3/MinIO) в байтах';
COMMENT ON COLUMN analytics_stats.backups_count IS 'Количество бэкапов';
COMMENT ON COLUMN analytics_stats.db_tables_count IS 'Количество таблиц в БД';
COMMENT ON COLUMN analytics_stats.indexes_size IS 'Общий размер всех индексов в БД в байтах';
COMMENT ON COLUMN analytics_stats.active_connections IS 'Количество активных подключений к БД';
COMMENT ON COLUMN analytics_stats.db_size IS 'Размер основной БД в байтах';
