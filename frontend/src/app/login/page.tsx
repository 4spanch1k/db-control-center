"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const response = await fetch("http://localhost:8000/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Неверный email или пароль");
            }

            document.cookie = `access_token=${data.access_token}; path=/; max-age=86400; SameSite=Strict`;

            router.push("/");
            router.refresh();

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Ошибка авторизации";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h1>DB Control Center</h1>
                    <p>Вход в панель управления инфраструктурой</p>
                </div>

                <form onSubmit={handleLogin} className={styles.formGroup}>
                    <div className={styles.formGroup}>
                        <label htmlFor="email" className={styles.label}>Email</label>
                        <input
                            id="email"
                            type="email"
                            className={styles.input}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="password" className={styles.label}>Пароль</label>
                        <input
                            id="password"
                            type="password"
                            className={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    <button type="submit" className={styles.button} disabled={isLoading}>
                        {isLoading ? "Подключение..." : "Войти в систему"}
                    </button>
                </form>
            </div>
        </div>
    );
}
