"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card/Card";
import styles from "./page.module.css";

interface ConnectionForm {
  name: string;
  db_type: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database_name: string;
}

export default function SettingsPage() {
  const [form, setForm] = useState<ConnectionForm>({
    name: "Main PostgreSQL",
    db_type: "postgresql",
    host: "localhost",
    port: "5432",
    username: "postgres",
    password: "",
    database_name: "postgres",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: keyof ConnectionForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: form.name.trim(),
          db_type: form.db_type,
          host: form.host.trim(),
          port: Number(form.port),
          username: form.username.trim(),
          password: form.password,
          database_name: form.database_name.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Не удалось проверить подключение");
      }

      setMessage("Подключение проверено и сохранено. Теперь можно делать бэкапы на дашборде.");
      setForm((prev) => ({ ...prev, password: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка подключения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Настройки</h1>
      <p className={styles.subtitle}>
        Шаг 1: подключите свою PostgreSQL базу. После успешной проверки система сохранит конфигурацию.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Мастер подключения БД</CardTitle>
        </CardHeader>
        <CardContent>
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Название подключения</span>
              <input
                className={styles.input}
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                <span>Тип БД</span>
                <select
                  className={styles.input}
                  value={form.db_type}
                  onChange={(e) => handleChange("db_type", e.target.value)}
                >
                  <option value="postgresql">PostgreSQL</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Порт</span>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) => handleChange("port", e.target.value)}
                  required
                />
              </label>
            </div>

            <div className={styles.row}>
              <label className={styles.field}>
                <span>Хост</span>
                <input
                  className={styles.input}
                  value={form.host}
                  onChange={(e) => handleChange("host", e.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>База данных</span>
                <input
                  className={styles.input}
                  value={form.database_name}
                  onChange={(e) => handleChange("database_name", e.target.value)}
                />
              </label>
            </div>

            <div className={styles.row}>
              <label className={styles.field}>
                <span>Пользователь</span>
                <input
                  className={styles.input}
                  value={form.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Пароль</span>
                <input
                  className={styles.input}
                  type="password"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  required
                />
              </label>
            </div>

            <button className={styles.submitButton} type="submit" disabled={loading}>
              {loading ? "Проверяем..." : "Проверить и сохранить"}
            </button>
          </form>

          {message && <p className={styles.success}>{message}</p>}
          {error && <p className={styles.error}>{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
