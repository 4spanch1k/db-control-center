'use client';

import { useState } from 'react';

import { useAnalytics } from '@/hooks/useAnalytics';
import styles from './AnalyticsDashboard.module.css';
import MetricsCard from '../MetricsCard/MetricsCard';
import AnalyticsTable from '../AnalyticsTable/AnalyticsTable';
import { Package, HardDrive, DollarSign, List, HeartPulse, Plug } from 'lucide-react';
import {
  formatBytes,
} from '@/lib/types';

interface AnalyticsDashboardProps {
  refreshInterval?: number; // в миллисекундах
}

export default function AnalyticsDashboard({
  refreshInterval = 60000,
}: AnalyticsDashboardProps) {
  const {
    loading,
    error,
    summary,
    delta,
    recentData,
  } = useAnalytics(refreshInterval);

  const [selectedPeriod, setSelectedPeriod] = useState('1 day');

  const handleRowClick = () => {
    // Открытие модального окна с деталями
  };

  return (
    <div className={styles.container}>
      {/* Заголовок */}
      <div className={styles.header}>
        <h1 className={styles.title}>Обзор аналитики</h1>
        <p className={styles.subtitle}>
          Мониторинг состояния БД и управление бэкапами
        </p>

        {/* Контролы периода */}
        <div className={styles.controls}>
          <div className={styles.period}>
            <span className={styles.periodLabel}>Период:</span>
            {['1 hour', '1 day', '7 days', '30 days'].map((period) => (
              <button
                key={period}
                className={`${styles.periodButton} ${selectedPeriod === period ? styles.active : ''
                  }`}
                onClick={() => setSelectedPeriod(period)}
              >
                {period === '1 hour'
                  ? 'За час'
                  : period === '1 day'
                    ? 'За день'
                    : period === '7 days'
                      ? 'За неделю'
                      : 'За месяц'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className={styles.errorBanner}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorContent}>
            <h3 className={styles.errorTitle}>Предупреждение</h3>
            <p className={styles.errorMessage}>{error}</p>
          </div>
        </div>
      )}

      {/* Главные метрики */}
      <div className={styles.metricsGrid}>
        <MetricsCard
          title="Бэкапы"
          value={summary?.current_backups_count ?? 0}
          icon={Package}
          footer="Всего бэкапов"
          loading={loading}
        />
        <MetricsCard
          title="Размер бэкапов"
          value={formatBytes(summary?.current_backups_size ?? 0)}
          icon={HardDrive}
          footer="Общий объем"
          loading={loading}
        />
        <MetricsCard
          title="Сэкономлено"
          value={formatBytes(delta?.saved_space ?? 0)}
          icon={DollarSign}
          change={delta?.space_efficiency_percent}
          changeLabel="эффективность"
          loading={loading}
        />
        <MetricsCard
          title="Таблицы БД"
          value={summary?.db_tables ?? 0}
          icon={List}
          footer="Структуры БД"
          loading={loading}
        />
        <MetricsCard
          title="Здоровье БД"
          value={`${summary?.db_health_score ?? 0}%`}
          icon={HeartPulse}
          footer="Статус здоровья"
          loading={loading}
        />
        <MetricsCard
          title="Подключения"
          value={summary?.active_connections ?? 0}
          icon={Plug}
          footer="Активных соединений"
          loading={loading}
        />
      </div>

      {/* Таблица аналитики */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>📊 История аналитики</h2>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner} />
              <span className={styles.spinnerText}>Загрузка данных...</span>
            </div>
          ) : (
            <AnalyticsTable
              data={recentData}
              onRowClick={handleRowClick}
              maxRows={30}
            />
          )}
        </div>
      </div>

      {/* Дополнительная информация */}
      {delta && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>📈 Анализ эффективности</h2>
          <div className={styles.detailsGrid}>
            <div className={styles.detailCard}>
              <div className={styles.detailLabel}>Текущий объем бэкапов</div>
              <div className={styles.detailValue}>
                {formatBytes(delta.current_backups_size)}
              </div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailLabel}>Сэкономленное место</div>
              <div className={styles.detailValue}>
                {formatBytes(delta.saved_space)}
              </div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailLabel}>Всего когда-либо сохранено</div>
              <div className={styles.detailValue}>
                {formatBytes(delta.total_ever_stored)}
              </div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailLabel}>Эффективность очистки</div>
              <div className={styles.detailValue}>
                {delta.space_efficiency_percent}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
