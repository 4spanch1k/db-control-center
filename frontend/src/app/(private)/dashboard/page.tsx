"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./dashboard.module.css";
import CleanupButton from "@/components/CleanupButton/CleanupButton";
import BackupProfiles from "@/components/BackupProfiles/BackupProfiles";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card/Card";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { S } from "@/lib/strings";
import { SkeletonTableRows, SkeletonUsageGrid, SkeletonLine } from "@/components/ui/Skeleton/Skeleton";

interface Backup {
  id: number;
  db_name: string;
  file_path: string;
  status: string;
  created_at: string;
  action?: string;
  size_bytes?: number;
  profile_id?: string;
  profile_meta?: {
    name?: string;
    profile_name?: string;
    mode?: string;
    profile_mode?: string;
    data_mode?: string;
    include_schemas?: string[];
    exclude_schemas?: string[];
    include_tables?: string[];
    exclude_tables?: string[];
  };
  verified_at?: string | null;
  verify_status?: string | null;
  verify_log?: string | null;
}

type RestoreTarget = "existing_database" | "new_database";

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

interface RetentionCleanupStatusPayload {
  success: boolean;
  retention_days: number;
  retention_copies: number;
  cleanup_cron: string;
  is_enabled: boolean;
  last_run_at?: string | null;
  last_deleted_count: number;
  last_error_count: number;
  last_status?: string | null;
  last_reason?: string | null;
  last_details?: string | null;
}

interface RestorePreparePayload {
  success: boolean;
  request_id: string;
  filename: string;
  backup_size_bytes: number;
  objects_count: number;
  active_connections: number;
  backup_profile_name: string;
  backup_profile_mode: "full" | "custom";
  is_partial_backup: boolean;
  default_restore_target: RestoreTarget;
  warning?: string | null;
  expires_at: string;
}

interface VerifyPayload {
  success: boolean;
  filename: string;
  verify_status: "success" | "error" | "partial";
  verified_at: string;
  verify_log: string;
}

export default function Home() {
  const { toast } = useToast();
  const [history, setHistory] = useState<Backup[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [planCode, setPlanCode] = useState<string>("free");
  const [usageRows, setUsageRows] = useState<UsageLimitRow[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [retentionStatus, setRetentionStatus] = useState<RetentionCleanupStatusPayload | null>(null);
  const [retentionLoading, setRetentionLoading] = useState(true);
  const [restorePrepare, setRestorePrepare] = useState<RestorePreparePayload | null>(null);
  const [restorePreparingFile, setRestorePreparingFile] = useState<string | null>(null);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState<string>("");
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget>("existing_database");
  const [restoreNewDatabaseName, setRestoreNewDatabaseName] = useState<string>("");
  const [restoreExistingDangerConfirm, setRestoreExistingDangerConfirm] = useState<string>("");
  const [restoreSubmitting, setRestoreSubmitting] = useState<boolean>(false);
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [verifyProcessingFile, setVerifyProcessingFile] = useState<string | null>(null);
  const [demoHintsActive, setDemoHintsActive] = useState<boolean>(false);

  // Backup profiles state
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const resolveProfileMeta = (backup: Backup) => {
    const meta = backup.profile_meta || {};
    const modeRaw = String(meta.mode || meta.profile_mode || "full").toLowerCase();
    const mode = modeRaw === "custom" ? "custom" : "full";
    const name = String(meta.name || meta.profile_name || (mode === "custom" ? "Partial backup" : "Full backup"));
    return {
      mode,
      name,
      hasExplicitMeta: Boolean(meta.name || meta.profile_name || meta.mode || meta.profile_mode),
    };
  };

  const actionLabels: Record<string, string> = {
    "backup.create": "Создание бэкапа",
    "backup.restore": "Восстановление",
    "backup.verify": "Проверка бэкапа",
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
    } finally {
      setHistoryLoading(false);
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
    } finally {
      setUsageLoading(false);
    }
  };

  const fetchConnectionDetails = async () => {
    try {
      const res = await fetch("/api/connections");
      const json = await res.json();
      if (res.ok && json.success && json.data?.length > 0) {
        setConnectionId(json.data[0].id);
      }
    } catch (e) {
      console.error("Не удалось загрузить подключения", e);
    }
  };

  const fetchRetentionStatus = async () => {
    try {
      const res = await fetch("/api/cleanup/status");
      const json = await res.json();
      if (res.ok && json.success) {
        setRetentionStatus(json.data);
      }
    } catch (e) {
      console.error("Не удалось загрузить статус retention cleanup", e);
    } finally {
      setRetentionLoading(false);
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
      void fetchConnectionDetails();
      void fetchRetentionStatus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const handleBackup = async () => {
    setBackupLoading(true);
    toast(S.dashboard.backupSending, "info");

    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedProfileId ? { profile_id: selectedProfileId } : {})
      });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        toast(S.dashboard.backupCreated, "success");
        fetchHistory();
        fetchUsageLimits();
      } else if (res.status === 429) {
        toast(payload?.detail || S.dashboard.rateLimitExceeded, "warning");
        fetchUsageLimits();
      } else {
        toast(payload?.detail || S.dashboard.backupError, "error");
      }
    } catch {
      toast(S.dashboard.serverUnavailable, "error");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleCleanupSuccess = () => {
    fetchHistory();
    fetchRetentionStatus();
  };

  const handleToggleDemoHints = () => {
    setDemoHintsActive((previous) => {
      const next = !previous;
      if (next) {
        const actionsNode = document.getElementById("db-actions");
        actionsNode?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return next;
    });
  };

  const handleRestore = async (item: Backup) => {
    setRestorePreparingFile(item.file_path);
    setRestorePrepare(null);
    setRestoreConfirmInput("");
    setRestoreTarget("existing_database");
    setRestoreNewDatabaseName("");
    setRestoreExistingDangerConfirm("");
    toast(S.dashboard.restorePreparing, "info");
    try {
      const res = await fetch('/api/backup/restore/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: item.file_path })
      });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        const prepareData = payload?.data as RestorePreparePayload;
        if (!prepareData?.request_id) {
          throw new Error("Некорректный ответ prepare restore");
        }
        setRestorePrepare(prepareData);
        setRestoreTarget(prepareData?.default_restore_target || "existing_database");
      } else if (res.status === 429) {
        toast(payload?.detail || S.dashboard.rateLimitExceeded, "warning");
        fetchUsageLimits();
      } else {
        toast(payload?.error || payload?.detail || S.dashboard.restorePrepareError, "error");
      }
    } catch (error) {
      toast(S.dashboard.serverUnavailable, "error");
      console.error(error);
    } finally {
      setRestorePreparingFile(null);
    }
  };

  const handleVerify = async (item: Backup) => {
    setVerifyProcessingFile(item.file_path);
    toast(S.dashboard.verifyRunning, "info");
    try {
      const res = await fetch('/api/backup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: item.file_path, deep_check: true }),
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        toast(payload?.error || payload?.detail || S.dashboard.verifyError, "error");
        return;
      }

      const verifyData = payload?.data as VerifyPayload | undefined;
      if (!verifyData?.verify_status) {
        toast(S.dashboard.verifyError, "error");
        return;
      }

      if (verifyData.verify_status === "success") {
        toast(S.dashboard.verifySuccess, "success");
      } else if (verifyData.verify_status === "partial") {
        toast(S.dashboard.verifyPartial, "warning");
      } else {
        toast(verifyData.verify_log || S.dashboard.verifyError, "error");
      }

      fetchHistory();
    } catch (error) {
      toast(S.dashboard.serverUnavailable, "error");
      console.error(error);
    } finally {
      setVerifyProcessingFile(null);
    }
  };

  const closeRestoreModal = () => {
    if (restoreSubmitting) {
      return;
    }
    setRestorePrepare(null);
    setRestoreConfirmInput("");
    setRestoreTarget("existing_database");
    setRestoreNewDatabaseName("");
    setRestoreExistingDangerConfirm("");
  };

  const handleConfirmRestore = async () => {
    if (!restorePrepare) {
      return;
    }

    setRestoreSubmitting(true);
    toast(S.dashboard.restorePreparing, "info");

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: restorePrepare.request_id,
          filename_confirmation: restoreConfirmInput.trim(),
          restore_target: restoreTarget,
          target_database_name: restoreTarget === "new_database" ? restoreNewDatabaseName.trim() : undefined,
          existing_target_confirmation:
            restorePrepare.is_partial_backup && restoreTarget === "existing_database"
              ? restoreExistingDangerConfirm.trim()
              : undefined,
        }),
      });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        toast(S.dashboard.restoreStarted, "success");
        setRestorePrepare(null);
        setRestoreConfirmInput("");
        setRestoreTarget("existing_database");
        setRestoreNewDatabaseName("");
        setRestoreExistingDangerConfirm("");
        fetchHistory();
        fetchUsageLimits();
      } else if (res.status === 429) {
        toast(payload?.detail || S.dashboard.rateLimitExceeded, "warning");
        fetchUsageLimits();
      } else {
        toast(payload?.error || payload?.detail || S.dashboard.restoreError, "error");
      }
    } catch (error) {
      toast(S.dashboard.serverUnavailable, "error");
      console.error(error);
    } finally {
      setRestoreSubmitting(false);
    }
  };

  const isPartialRestore = restorePrepare?.is_partial_backup ?? false;
  const isExistingTarget = restoreTarget === "existing_database";
  const requireExistingDangerConfirm = isPartialRestore && isExistingTarget;
  const isFilenameConfirmed = restorePrepare ? restoreConfirmInput.trim() === restorePrepare.filename : false;
  const isNewDatabaseValid =
    restoreTarget !== "new_database" || restoreNewDatabaseName.trim().length > 0;
  const isExistingDangerConfirmed =
    !requireExistingDangerConfirm || restoreExistingDangerConfirm.trim() === "RESTORE INTO EXISTING";
  const canSubmitRestore =
    Boolean(restorePrepare) && isFilenameConfirmed && isNewDatabaseValid && isExistingDangerConfirmed && !restoreSubmitting;
  const showEmptyDashboardHint = !historyLoading && history.length === 0;
  const hasConnection = Boolean(connectionId);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Обзор</h1>
      {showEmptyDashboardHint && (
        <Card className={`${styles.card} ${styles.demoGuide}`}>
          <CardContent>
            <h2 className={styles.demoTitle}>{S.dashboard.demoGuideTitle}</h2>
            <p className={styles.demoFlow}>{S.dashboard.emptyStateFlow}</p>
            <p className={styles.demoHintText}>{S.dashboard.demoGuideHint}</p>
            <div className={styles.demoActions}>
              <button
                type="button"
                className={styles.demoStartButton}
                onClick={handleToggleDemoHints}
              >
                {demoHintsActive ? S.dashboard.demoStop : S.dashboard.demoStart}
              </button>
              <Link
                href="/settings"
                className={`${styles.demoLink} ${demoHintsActive && !hasConnection ? styles.demoHighlight : ""}`}
              >
                {S.dashboard.demoStepConnect}
              </Link>
              <a
                href="#db-actions"
                className={`${styles.demoLink} ${demoHintsActive && hasConnection ? styles.demoHighlight : ""}`}
              >
                {S.dashboard.demoStepBackup}
              </a>
            </div>
            <p className={styles.demoHintText}>
              {hasConnection ? S.dashboard.demoConnectionReady : S.dashboard.demoConnectionMissing}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Лимиты тарифа ── */}
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>Лимиты тарифа на сегодня</CardTitle>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <>
              <SkeletonLine size="md" width="200px" />
              <div style={{ marginTop: 14 }}>
                <SkeletonUsageGrid items={4} />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Управление БД и профили ── */}
      <div className={styles.actions}>
        {connectionId && (
          <Card className={`${styles.card} ${demoHintsActive ? styles.demoHighlight : ""}`}>
            <CardContent>
              <BackupProfiles
                connectionId={connectionId}
                selectedProfileId={selectedProfileId}
                onSelectProfile={setSelectedProfileId}
              />
            </CardContent>
          </Card>
        )}

        <div id="db-actions">
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
                <button
                  className={`${styles.button} ${demoHintsActive && hasConnection ? styles.demoHighlight : ""}`}
                  onClick={handleBackup}
                  disabled={backupLoading}
                >
                  {backupLoading ? "Создание..." : "Сделать бэкап"}
                </button>
                <CleanupButton onSuccess={handleCleanupSuccess} />
              </div>
              <div className={styles.retentionPanel}>
                <div className={styles.retentionTitle}>Retention Cleanup</div>
                {retentionLoading ? (
                  <div className={styles.retentionRow}>Загрузка статуса...</div>
                ) : retentionStatus ? (
                  <>
                    <div className={styles.retentionRow}>
                      Policy: {retentionStatus.retention_days} дн. / минимум {retentionStatus.retention_copies} копий
                    </div>
                    <div className={styles.retentionRow}>
                      Последний запуск:{" "}
                      {retentionStatus.last_run_at
                        ? new Date(retentionStatus.last_run_at).toLocaleString("ru-RU")
                        : "еще не запускался"}
                    </div>
                    <div className={styles.retentionRow}>
                      Удалено: {retentionStatus.last_deleted_count} | Ошибки: {retentionStatus.last_error_count}
                    </div>
                    {retentionStatus.last_error_count > 0 && retentionStatus.last_details && (
                      <div className={styles.retentionError}>{retentionStatus.last_details}</div>
                    )}
                  </>
                ) : (
                  <div className={styles.retentionRow}>Нет данных о retention cleanup</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── История бэкапов ── */}
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
                {historyLoading ? (
                  <SkeletonTableRows rows={5} columns={6} />
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--color-text-tertiary)", padding: "24px 0" }}>
                      <div className={styles.emptyStateFlow}>{S.dashboard.emptyStateFlow}</div>
                      <div className={styles.emptyStateHelp}>{S.dashboard.emptyStateHelp}</div>
                    </td>
                  </tr>
                ) : (
                  history.map((item) => {
                    const profile = resolveProfileMeta(item);
                    const isArtifactRow = !item.action || item.action === "create";
                    const showProfileBadge = isArtifactRow || profile.hasExplicitMeta;
                    const verifyStatus = String(item.verify_status || "").toLowerCase();
                    const hasVerify = Boolean(item.verified_at || verifyStatus);
                    const verifyLabel =
                      verifyStatus === "success"
                        ? "Verified"
                        : verifyStatus === "partial"
                          ? "Verify Partial"
                          : verifyStatus === "error"
                            ? "Verify Error"
                            : "Not Verified";
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.db_name}</td>
                        <td className={styles.fileName}>
                          {item.file_path}
                          {showProfileBadge && (
                            <div className={styles.profileBadgeRow}>
                              <span
                                className={`${styles.profileBadge} ${
                                  profile.mode === "custom" ? styles.profileBadgePartial : styles.profileBadgeFull
                                }`}
                              >
                                {profile.mode === "custom" ? "Partial" : "Full"} | {profile.name}
                              </span>
                            </div>
                          )}
                          {isArtifactRow && (
                            <div className={styles.verifyMeta}>
                              <span
                                className={`${styles.verifyBadge} ${
                                  verifyStatus === "success"
                                    ? styles.verifyBadgeSuccess
                                    : verifyStatus === "partial"
                                      ? styles.verifyBadgePartial
                                      : verifyStatus === "error"
                                        ? styles.verifyBadgeError
                                        : styles.verifyBadgeUnknown
                                }`}
                                title={item.verify_log || undefined}
                              >
                                {verifyLabel}
                              </span>
                              {hasVerify && item.verified_at && (
                                <span className={styles.verifyTime}>
                                  {new Date(item.verified_at).toLocaleString("ru-RU")}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={item.status === 'success' ? styles.badgeSuccess : styles.badgeError}>
                            {item.status}
                          </span>
                        </td>
                        <td>{new Date(item.created_at).toLocaleString('ru-RU')}</td>
                        <td>
                          {isArtifactRow ? (
                            <div className={styles.actionButtons}>
                              <button
                                className={styles.restoreButton}
                                disabled={restoreSubmitting || restorePreparingFile === item.file_path}
                                onClick={() => handleRestore(item)}
                              >
                                {restorePreparingFile === item.file_path ? "Подготовка..." : "Восстановить"}
                              </button>
                              <button
                                className={styles.verifyButton}
                                disabled={restoreSubmitting || Boolean(verifyProcessingFile)}
                                onClick={() => handleVerify(item)}
                              >
                                {verifyProcessingFile === item.file_path ? "Verify..." : "Verify"}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "var(--color-text-tertiary)" }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* ── Модалка восстановления ── */}
      {restorePrepare && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h2 className={styles.modalTitle}>Подтверждение восстановления</h2>
            <p className={styles.modalText}>
              Профиль бэкапа: <strong>{restorePrepare.backup_profile_name}</strong> (
              {restorePrepare.is_partial_backup ? "Partial" : "Full"})
            </p>

            {restorePrepare.is_partial_backup ? (
              <p className={`${styles.modalCallout} ${styles.modalCalloutWarning}`}>
                Это partial restore: будут восстановлены не все объекты БД, а только выбранные объекты из профиля.
              </p>
            ) : (
              <p className={`${styles.modalCallout} ${styles.modalCalloutInfo}`}>
                Это full restore: будет восстановлена вся структура и данные из бэкапа.
              </p>
            )}

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

            <div className={styles.targetSection}>
              <span className={styles.modalLabel}>Restore target</span>
              <div className={styles.targetOptions}>
                <label className={`${styles.targetOption} ${isExistingTarget ? styles.targetOptionActive : ""}`}>
                  <input
                    type="radio"
                    name="restore-target"
                    value="existing_database"
                    checked={restoreTarget === "existing_database"}
                    onChange={() => setRestoreTarget("existing_database")}
                  />
                  <span>Restore into existing database</span>
                </label>
                <label className={`${styles.targetOption} ${!isExistingTarget ? styles.targetOptionActive : ""}`}>
                  <input
                    type="radio"
                    name="restore-target"
                    value="new_database"
                    checked={restoreTarget === "new_database"}
                    onChange={() => setRestoreTarget("new_database")}
                  />
                  <span>Restore into new database</span>
                </label>
              </div>
            </div>

            {restoreTarget === "new_database" && (
              <>
                <label className={styles.modalLabel} htmlFor="restore-new-db">
                  Имя новой базы для восстановления
                </label>
                <input
                  id="restore-new-db"
                  className={styles.modalInput}
                  value={restoreNewDatabaseName}
                  onChange={(event) => setRestoreNewDatabaseName(event.target.value)}
                  placeholder="control_center_restore_20260306"
                  autoComplete="off"
                />
              </>
            )}

            {requireExistingDangerConfirm && (
              <p className={`${styles.modalCallout} ${styles.modalCalloutDanger}`}>
                Partial restore в existing database может повредить целостность данных.
                Режим разрешен только с дополнительным подтверждением.
              </p>
            )}

            {restorePrepare.warning && (
              <p className={`${styles.modalCallout} ${styles.modalCalloutWarning}`}>{restorePrepare.warning}</p>
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

            {requireExistingDangerConfirm && (
              <>
                <label className={styles.modalLabel} htmlFor="restore-existing-danger-confirm">
                  Для partial restore в existing database введите &quot;RESTORE INTO EXISTING&quot;
                </label>
                <input
                  id="restore-existing-danger-confirm"
                  className={styles.modalInput}
                  value={restoreExistingDangerConfirm}
                  onChange={(event) => setRestoreExistingDangerConfirm(event.target.value)}
                  placeholder="RESTORE INTO EXISTING"
                  autoComplete="off"
                />
              </>
            )}

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
                disabled={!canSubmitRestore}
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
