import Link from "next/link";
import { cookies } from "next/headers";
import styles from "./page.module.css";

export default async function LandingPage() {
  const cookieStore = await cookies();
  const hasSession =
    Boolean(cookieStore.get("access_token")?.value) ||
    Boolean(cookieStore.get("refresh_token")?.value);

  return (
    <main className={styles.page}>
      <div className={styles.gridGlow} aria-hidden />
      <div className={`${styles.orb} ${styles.orbA}`} aria-hidden />
      <div className={`${styles.orb} ${styles.orbB}`} aria-hidden />

      <section className={styles.hero}>
        <p className={styles.kicker}>BACKUP • RESTORE • ANALYTICS</p>
        <h1 className={styles.brand}>DB CONTROL CENTER</h1>
        <p className={styles.subtitle}>
          Мы автоматизируем бэкапы, восстановление и мониторинг PostgreSQL в одном понятном интерфейсе.
        </p>
        <div className={styles.highlights}>
          <article className={styles.highlightCard}>
            <h2 className={styles.highlightTitle}>Чем занимаемся</h2>
            <p className={styles.highlightText}>
              Централизуем резервное копирование, запуск restore и оперативную аналитику состояния базы.
            </p>
          </article>
          <article className={styles.highlightCard}>
            <h2 className={styles.highlightTitle}>Почему выбрать нас</h2>
            <p className={styles.highlightText}>
              Минимум ручной рутины, быстрый контроль инфраструктуры и прозрачные процессы для команды.
            </p>
          </article>
        </div>

        <div className={styles.actions}>
          <Link href={hasSession ? "/dashboard" : "/login"} className={styles.primary}>
            {hasSession ? "Открыть панель" : "Вход"}
          </Link>
          <Link href="/register" className={styles.secondary}>
            Регистрация
          </Link>
        </div>
      </section>
    </main>
  );
}
