"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./register.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Не удалось зарегистрировать пользователя");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <p className={styles.badge}>AUTH</p>
        <h1 className={styles.title}>Регистрация</h1>
        <p className={styles.description}>Создайте аккаунт и получите доступ к панели управления.</p>

        <form className={styles.form} onSubmit={handleRegister}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={styles.input}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className={styles.label} htmlFor="password">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            className={styles.input}
            placeholder="Минимум 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label className={styles.label} htmlFor="confirm-password">
            Повторите пароль
          </label>
          <input
            id="confirm-password"
            type="password"
            className={styles.input}
            placeholder="Повторите пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.primary} disabled={isLoading}>
            {isLoading ? "Создаём аккаунт..." : "Зарегистрироваться"}
          </button>
        </form>

        <div className={styles.actions}>
          <Link href="/login" className={styles.link}>
            Уже есть аккаунт? Вход
          </Link>
          <Link href="/" className={styles.link}>
            На главную
          </Link>
        </div>
      </section>
    </main>
  );
}
