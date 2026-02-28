'use client';

import React, { useState, useMemo } from 'react';
import styles from './AnalyticsTable.module.css';
import {
  AnalyticRecord,
  formatBytes,
  getHealthStatus,
} from '@/lib/types';

interface AnalyticsTableProps {
  data?: AnalyticRecord[];
  loading?: boolean;
  onRowClick?: (record: AnalyticRecord) => void;
  maxRows?: number;
}

export default function AnalyticsTable({
  data = [],
  loading = false,
  onRowClick,
  maxRows = 30,
}: AnalyticsTableProps) {
  const [sortField, setSortField] = useState<keyof AnalyticRecord>(
    'timestamp'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const displayData = useMemo(() => {
    const sorted = [...data];

    // Сортировка
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });

    // Ограничиваем количество строк
    return sorted.slice(0, maxRows);
  }, [data, sortField, sortOrder, maxRows]);

  const handleHeaderClick = (field: keyof AnalyticRecord) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th className={styles.tableHeader}>Время</th>
              <th className={styles.tableHeader}>Бэкапы</th>
              <th className={styles.tableHeader}>Размер БД</th>
              <th className={styles.tableHeader}>Таблицы</th>
              <th className={styles.tableHeader}>Подключения</th>
              <th className={styles.tableHeader}>Статус</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className={styles.skeletonRow}>
                <td colSpan={6}>
                  <div className={`${styles.skeletonCell} skeleton skeleton-text`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (displayData.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>📊</div>
        <div className={styles.emptyStateTitle}>Нет данных</div>
        <div className={styles.emptyStateText}>
          Аналитические данные еще не собраны. Дождитесь первой записи от n8n.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th className={styles.tableHeader}>
                <button
                  onClick={() => handleHeaderClick('timestamp')}
                  className={styles.tableHeaderSortable}
                >
                  Время
                  {sortField === 'timestamp' && (
                    <span className={styles.sortIcon}>
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className={styles.tableHeader}>
                <button
                  onClick={() => handleHeaderClick('backups_count')}
                  className={styles.tableHeaderSortable}
                >
                  Бэкапы
                  {sortField === 'backups_count' && (
                    <span className={styles.sortIcon}>
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className={styles.tableHeader}>
                <button
                  onClick={() => handleHeaderClick('total_backups_size')}
                  className={styles.tableHeaderSortable}
                >
                  Размер Бэкапов
                  {sortField === 'total_backups_size' && (
                    <span className={styles.sortIcon}>
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className={styles.tableHeader}>
                <button
                  onClick={() => handleHeaderClick('db_size')}
                  className={styles.tableHeaderSortable}
                >
                  Размер БД
                  {sortField === 'db_size' && (
                    <span className={styles.sortIcon}>
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className={styles.tableHeader}>
                <button
                  onClick={() => handleHeaderClick('db_tables_count')}
                  className={styles.tableHeaderSortable}
                >
                  Таблицы
                  {sortField === 'db_tables_count' && (
                    <span className={styles.sortIcon}>
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className={styles.tableHeader}>
                <button
                  onClick={() => handleHeaderClick('active_connections')}
                  className={styles.tableHeaderSortable}
                >
                  Подключения
                  {sortField === 'active_connections' && (
                    <span className={styles.sortIcon}>
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className={styles.tableHeader}>Статус</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {displayData.map((record) => {
              const healthStatus = getHealthStatus(
                record.active_connections
              );
              return (
                <tr
                  key={record.id}
                  className={`${styles.tableRow} ${onRowClick ? styles.clickable : ''}`}
                  onClick={() => onRowClick?.(record)}
                >
                  <td className={styles.tableCell}>
                    <span className={styles.tableCellTime}>
                      {new Date(record.timestamp).toLocaleString('ru-RU')}
                    </span>
                  </td>
                  <td className={`${styles.tableCell} ${styles.tableCellNumeric}`}>
                    <div className={styles.metric}>
                      <span>📦</span>
                      <span>{record.backups_count}</span>
                    </div>
                  </td>
                  <td className={`${styles.tableCell} ${styles.tableCellNumeric}`}>
                    {formatBytes(record.total_backups_size)}
                  </td>
                  <td className={`${styles.tableCell} ${styles.tableCellNumeric}`}>
                    {formatBytes(record.db_size || 0)}
                  </td>
                  <td className={`${styles.tableCell} ${styles.tableCellNumeric}`}>
                    <div className={styles.metric}>
                      <span>📋</span>
                      <span>{record.db_tables_count}</span>
                    </div>
                  </td>
                  <td className={`${styles.tableCell} ${styles.tableCellNumeric}`}>
                    <div className={styles.metric}>
                      <span>🔌</span>
                      <span>{record.active_connections}</span>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.statusCell}>
                      <div
                        className={`${styles.statusDot} ${healthStatus.status === 'healthy'
                          ? styles.statusDotHealthy
                          : healthStatus.status === 'warning'
                            ? styles.statusDotWarning
                            : styles.statusDotCritical
                          }`}
                      />
                      <span className={styles.statusLabel}>
                        {healthStatus.status === 'healthy'
                          ? 'OK'
                          : healthStatus.status === 'warning'
                            ? '⚠ Внимание'
                            : '❌ Критично'}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
