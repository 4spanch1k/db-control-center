// Типы для аналитики
export interface AnalyticRecord {
  id: number;
  timestamp: string;
  total_backups_size: number;
  backups_count: number;
  db_tables_count: number;
  indexes_size: number;
  active_connections: number;
  db_size: number;
}

export interface DashboardSummary {
  current_backups_count: number;
  current_backups_size: number;
  total_saved_space: number;
  db_tables: number;
  active_connections: number;
  db_health_score: number;
  last_update: string;
}

export interface AnalyticsDelta {
  current_backups_size: number;
  saved_space: number;
  total_ever_stored: number;
  space_efficiency_percent: number;
}

export interface AnalyticsStatistic {
  avg_backups_size: number;
  max_backups_size: number;
  min_backups_size: number;
  avg_backups_count: number;
  max_backups_count: number;
  min_backups_count: number;
  avg_active_connections: number;
  max_active_connections: number;
  min_active_connections: number;
  records_count: number;
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  activeConnections: number;
  threshold: number;
}

export function getHealthStatus(activeConnections: number): HealthStatus {
  const threshold = 50;

  if (activeConnections <= 10) {
    return {
      status: 'healthy',
      activeConnections,
      threshold,
    };
  } else if (activeConnections <= 30) {
    return {
      status: 'warning',
      activeConnections,
      threshold,
    };
  } else {
    return {
      status: 'critical',
      activeConnections,
      threshold,
    };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ru-RU').format(num);
}
