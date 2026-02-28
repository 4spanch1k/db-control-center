'use client';

import React from 'react';
import { type LucideIcon, HelpCircle } from 'lucide-react';
import styles from './MetricsCard.module.css';

interface MetricsCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  change?: number;
  changeLabel?: string;
  footer?: string;
  loading?: boolean;
}

export default function MetricsCard({
  title,
  value,
  icon: Icon = HelpCircle,
  change,
  changeLabel,
  footer,
  loading = false,
}: MetricsCardProps) {
  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.skeleton}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonValue} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <Icon className={styles.icon} size={20} />
      </div>

      <div className={styles.content}>
        <div className={styles.value}>{value}</div>

        {change !== undefined && (
          <div
            className={`${styles.change} ${change > 0 ? styles.changePositive : styles.changeNegative
              }`}
          >
            {Math.abs(change)}% {changeLabel || 'от предыдущего периода'}
          </div>
        )}
      </div>

      {footer && (
        <div className={styles.footer}>
          <p className={styles.footerText}>{footer}</p>
        </div>
      )}
    </div>
  );
}
