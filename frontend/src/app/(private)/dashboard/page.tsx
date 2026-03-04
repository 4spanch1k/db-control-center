"use client";

import { useState, useEffect } from "react";
import styles from "./dashboard.module.css";
import CleanupButton from "@/components/CleanupButton/CleanupButton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card/Card";

interface Backup {
  id: number;
  db_name: string;
  file_path: string;
  status: string;
  created_at: string;
  action?: string;
  size_bytes?: number;
}

interface UsageLimitRow {
  action: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  blocked: boolean;
}

interface UsageLimitsPayload {
  success: boolean;
  plan: string;
  data: UsageLimitRow[];
}

interface RestorePreparePayload {
  success: boolean;
  request_id: string;
  filename: string;
  backup_size_bytes: number;
  objects_count: number;
  active_connections: number;
  warning?: string | null;
  expires_at: string;
}

export default function Home() {
  const [status, setStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<Backup[]>([]);
  const [planCode, setPlanCode] = useState<string>("free");
  const [usageRows, setUsageRows] = useState<UsageLimitRow[]>([]);
  const [restorePrepare, setRestorePrepare] = useState<RestorePreparePayload | null>(null);
  const [restorePreparingFile, setRestorePreparingFile] = useState<string | null>(null);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState<string>("");
  const [restoreSubmitting, setRestoreSubmitting] = useState<boolean>(false);

  const actionLabels: Record<string, string> = {
    "backup.create": "Создание бэкапа",
    "backup.restore": "Восстановление",
    "backup.cleanup": "Очистка бэкапов",
    "analytics.collect_manual": "Ручной сбор аналитики",
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const json = await res.json();
      if (json.success) {
        setHistory(json.data);
      }
    } catch (e) {
      console.error("Не удалось загрузить историю", e);
    }
  };

  const fetchUsageLimits = async () => {
    try {
      const res = await fetch("/api/usage/limits");
      const json = (await res.json()) as UsageLimitsPayload;
      if (res.ok && json?.success) {
        setPlanCode(String(json.plan || "free"));
        setUsageRows(Array.isArray(json.data) ? json.data : []);
      }
    } catch (e) {
      console.error("Не удалось загрузить лимиты тарифа", e);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchHistory();
      void fetchUsageLimits();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const handleBackup = async () => {
    setStatus("⏳ Отправка команды воркеру... (подождите)");

    try {
      const res = await fetch('/api/backup', { method: 'POST' });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        setStatus("✅ Бэкап успешно создан!");
        fetchHistory();
        fetchUsageLimits();
      } else if (res.status === 429) {
        setStatus(`⛔ ${payload?.detail || "Дневной лимит тарифа исчерпан. Перейдите на более высокий план."}`);
        fetchUsageLimits();
      } else {
        setStatus(`❌ ${payload?.detail || "Ошибка при создании бэкапа."}`);
      }
    } catch {
      setStatus("❌ Не удалось связаться с сервером.");
    }
  };

  const handleRestore = async (filename: string) => {
    setRestorePreparingFile(filename);
    setRestorePrepare(null);
    setRestoreConfirmInput("");
    setStatus("⏳ Подготовка безопасного восстановления...");
    try {
      const res = await fetch('/api/backup/restore/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        setStatus(null);
        setRestorePrepare(payload.data);
      } else if (res.status === 429) {
        setStatus(`⛔ ${payload?.detail || "Дневной лимит тарифа исчерпан. Перейдите на более высокий план."}`);
        fetchUsageLimits();
      } else {
        setStatus(`❌ ${payload?.error || payload?.detail || "Ошибка подготовки восстановления."}`);
      }
    } catch (error) {
      setStatus("❌ Не удалось связаться с сервером.");
      console.error(error);
    } finally {
      setRestorePreparingFile(null);
    }
  };

  const closeRestoreModal = () => {
    if (restoreSubmitting) {
      return;
    }
    setRestorePrepare(null);
    setRestoreConfirmInput("");
  };

  const handleConfirmRestore = async () => {
    if (!restorePrepare) {
      return;
    }

    setRestoreSubmitting(true);
    setStatus("⏳ Восстановление из бэкапа... (подождите)");

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: restorePrepare.request_id,
          filename_confirmation: restoreConfirmInput,
        }),
      });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        setStatus("✅ Восстановление запущено. Статус операции появится в истории.");
        setRestorePrepare(null);
        setRestoreConfirmInput("");
        fetchHistory();
        fetchUsageLimits();
      } else if (res.status === 429) {
        setStatus(`⛔ ${payload?.detail || "Дневной лимит тарифа исчерпан. Перейдите на более высокий план."}`);
        fetchUsageLimits();
      } else {
        setStatus(`❌ ${payload?.error || payload?.detail || "Ошибка запуска восстановления."}`);
      }
    } catch (error) {
      setStatus("❌ Не удалось связаться с сервером.");
      console.error(error);
    } finally {
      setRestoreSubmitting(false);
    }
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Обзор</h1>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>Лимиты тарифа на сегодня</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={styles.serverName}>
            Текущий план: <strong>{planCode.toUpperCase()}</strong>
          </p>
          <div className={styles.usageGrid}>
            {usageRows.map((row) => (
              <div
                key={row.action}
                className={`${styles.usageItem} ${row.blocked ? styles.usageBlocked : ""}`}
              >
                <div className={styles.usageTitle}>{actionLabels[row.action] || row.action}</div>
                <div className={styles.usageValue}>
                  {row.limit === null ? "Без лимита" : `${row.used}/${row.limit}`}
                </div>
                {row.limit !== null && (
                  <div className={styles.usageSubtext}>
                    Осталось: {Math.max((row.remaining ?? 0), 0)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className={styles.actions}>
        <Card className={styles.card}>
          <CardHeader>
            <CardTitle>Управление базой данных</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={styles.serverName}>Сервер: target-postgres | Порт: 5432</p>
            <p className={styles.permissionHint}>
              Действия доступны для всех тарифов. На Free и Pro действуют дневные лимиты, на Max лимитов нет.
            </p>
            <div className={styles.buttonGroup}>
              <button className={styles.button} onClick={handleBackup}>
                Сделать бэкап
              </button>
              <CleanupButton onSuccess={fetchHistory} />
            </div>
            {status && <div className={styles.status}>{status}</div>}
          </CardContent>
        </Card>
      </div>

      <div className={styles.historySection} id="history">
        <Card className={styles.historyCard}>
          <CardHeader>
            <CardTitle>История бэкапов</CardTitle>
          </CardHeader>
          <CardContent>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>База</th>
                  <th>Файл</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.db_name}</td>
                    <td className={styles.fileName}>{item.file_path}</td>
                    <td>
                      <span className={item.status === 'success' ? styles.badgeSuccess : styles.badgeError}>
                        {item.status}
                      </span>
                    </td>
                    <td>{new Date(item.created_at).toLocaleString('ru-RU')}</td>
                    <td>
                      <button
                        className={styles.restoreButton}
                        disabled={restoreSubmitting || restorePreparingFile === item.file_path}
                        onClick={() => handleRestore(item.file_path)}
                      >
                        {restorePreparingFile === item.file_path ? "Подготовка..." : "Восстановить"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {restorePrepare && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h2 className={styles.modalTitle}>Подтверждение восстановления</h2>
            <p className={styles.modalText}>
              Будет запущено полное восстановление базы. Текущие данные перезапишутся.
            </p>
            <div className={styles.modalMetaGrid}>
              <div className={styles.modalMetaItem}>
                <span className={styles.modalMetaLabel}>Файл</span>
                <span className={styles.modalMetaValue}>{restorePrepare.filename}</span>
              </div>
              <div className={styles.modalMetaItem}>
                <span className={styles.modalMetaLabel}>Размер</span>
                <span className={styles.modalMetaValue}>{formatBytes(restorePrepare.backup_size_bytes)}</span>
              </div>
              <div className={styles.modalMetaItem}>
                <span className={styles.modalMetaLabel}>Объектов в дампе</span>
                <span className={styles.modalMetaValue}>{restorePrepare.objects_count}</span>
              </div>
              <div className={styles.modalMetaItem}>
                <span className={styles.modalMetaLabel}>Активных подключений</span>
                <span className={styles.modalMetaValue}>{restorePrepare.active_connections}</span>
              </div>
            </div>

            {restorePrepare.warning && (
              <p className={styles.modalWarning}>{restorePrepare.warning}</p>
            )}

            <label className={styles.modalLabel} htmlFor="restore-confirm">
              Введите имя файла для подтверждения
            </label>
            <input
              id="restore-confirm"
              className={styles.modalInput}
              value={restoreConfirmInput}
              onChange={(event) => setRestoreConfirmInput(event.target.value)}
              placeholder={restorePrepare.filename}
              autoComplete="off"
            />

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={closeRestoreModal}
                disabled={restoreSubmitting}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.modalConfirmButton}
                onClick={handleConfirmRestore}
                disabled={restoreSubmitting || restoreConfirmInput.trim() !== restorePrepare.filename}
              >
                {restoreSubmitting ? "Запуск..." : "Подтвердить и восстановить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
