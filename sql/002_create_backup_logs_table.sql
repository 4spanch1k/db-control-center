-- =====================================================
-- 002_create_backup_logs_table.sql
-- Создание таблицы для логов бэкапов и удаленных объектов
-- =====================================================

-- Таблица для отслеживания удаленных объектов бэкапов
CREATE TABLE IF NOT EXISTS backup_deletion_logs (
    id BIGSERIAL PRIMARY KEY,
    backup_key VARCHAR(500) NOT NULL,
    deleted_size BIGINT NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по дате удаления
CREATE INDEX IF NOT EXISTS idx_backup_deletion_logs_deleted_at 
    ON backup_deletion_logs(deleted_at DESC);

-- Представление для подсчета сэкономленного места
CREATE OR REPLACE VIEW analytics_saved_space AS
SELECT 
    COALESCE(SUM(deleted_size), 0) as total_saved_space,
    COUNT(*) as total_deleted_backups,
    MAX(deleted_at) as last_deletion_time
FROM backup_deletion_logs;

COMMENT ON TABLE backup_deletion_logs IS 'Логи удаленных бэкапов для подсчета сэкономленного места';
COMMENT ON VIEW analytics_saved_space IS 'Представление для получения информации о сэкономленном месте';
