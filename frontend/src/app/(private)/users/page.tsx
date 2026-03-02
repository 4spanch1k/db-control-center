"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card/Card";
import styles from "./page.module.css";

type UserRole = "admin" | "operator" | "viewer";

interface UserRecord {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => Number(b.is_active) - Number(a.is_active)),
    [users]
  );

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/users");
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.detail || data?.error || "Не удалось загрузить пользователей");
      }

      setUsers(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateRole = async (userId: string, role: UserRole) => {
    setSavingUserId(userId);
    setMessage(null);
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.detail || data?.error || "Не удалось обновить роль");
      }

      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)));
      setMessage("Роль пользователя обновлена");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка обновления роли");
    } finally {
      setSavingUserId(null);
    }
  };

  const updateActive = async (userId: string, isActive: boolean) => {
    setSavingUserId(userId);
    setMessage(null);
    try {
      const response = await fetch(`/api/users/${userId}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.detail || data?.error || "Не удалось обновить статус");
      }

      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, is_active: isActive } : user))
      );
      setMessage("Статус пользователя обновлен");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка обновления статуса");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Пользователи</h1>

      <Card>
        <CardHeader>
          <CardTitle>Управление доступом</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className={styles.muted}>Загрузка пользователей...</p>}
          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}

          {!loading && !error && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Создан</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((user) => {
                    const isSaving = savingUserId === user.id;
                    return (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>
                          <select
                            className={styles.select}
                            value={user.role}
                            onChange={(e) => updateRole(user.id, e.target.value as UserRole)}
                            disabled={isSaving}
                          >
                            <option value="viewer">viewer</option>
                            <option value="operator">operator</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td>
                          <span className={user.is_active ? styles.active : styles.inactive}>
                            {user.is_active ? "active" : "inactive"}
                          </span>
                        </td>
                        <td>{new Date(user.created_at).toLocaleString("ru-RU")}</td>
                        <td>
                          <button
                            className={styles.actionButton}
                            onClick={() => updateActive(user.id, !user.is_active)}
                            disabled={isSaving}
                          >
                            {user.is_active ? "Деактивировать" : "Активировать"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
