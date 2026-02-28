"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
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

export default function Home() {
  const [status, setStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<Backup[]>([]);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory();
  }, []);

  const handleBackup = async () => {
    setStatus("⏳ Отправка команды воркеру... (подождите)");

    try {
      const res = await fetch('/api/backup', { method: 'POST' });

      if (res.ok) {
        setStatus("✅ Бэкап успешно создан!");
        fetchHistory();
      } else {
        setStatus("❌ Ошибка при создании бэкапа.");
      }
    } catch {
      setStatus("❌ Не удалось связаться с сервером.");
    }
  };

  const handleRestore = async (filename: string) => {
    if (!window.confirm(`Вы уверены? Текущие данные будут перезаписаны! (Файл: ${filename})`)) {
      return;
    }

    setStatus("⏳ Восстановление из бэкапа... (подождите)");
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });

      if (res.ok) {
        setStatus("✅ База успешно восстановлена!");
        fetchHistory();
      } else {
        setStatus("❌ Ошибка при восстановлении.");
      }
    } catch (error) {
      setStatus("❌ Не удалось связаться с сервером.");
      console.error(error);
    }
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Обзор аналитики</h1>

      <div className={styles.actions}>
        <Card className={styles.card}>
          <CardHeader>
            <CardTitle>Управление базой данных</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={styles.serverName}>Сервер: target-postgres | Порт: 5432</p>
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
                      <button className={styles.restoreButton} onClick={() => handleRestore(item.file_path)}>
                        Восстановить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
