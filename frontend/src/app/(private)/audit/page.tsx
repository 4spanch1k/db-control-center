"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card/Card";
import styles from "./page.module.css";

interface AuditRecord {
  id: number;
  user_email: string;
  user_role: string;
  action: string;
  resource: string;
  status: string;
  details?: string | null;
  created_at: string;
}

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAuditLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/audit/logs");
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.detail || data?.error || "Не удалось загрузить аудит-логи");
        }

        setRecords(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };

    loadAuditLogs();
  }, []);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Аудит действий</h1>

      <Card>
        <CardHeader>
          <CardTitle>Последние события</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className={styles.muted}>Загрузка...</p>}
          {error && <p className={styles.error}>{error}</p>}

          {!loading && !error && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Пользователь</th>
                    <th>Роль</th>
                    <th>Действие</th>
                    <th>Ресурс</th>
                    <th>Статус</th>
                    <th>Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.created_at).toLocaleString("ru-RU")}</td>
                      <td>{row.user_email}</td>
                      <td>{row.user_role}</td>
                      <td>{row.action}</td>
                      <td>{row.resource}</td>
                      <td>{row.status}</td>
                      <td>{row.details || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
