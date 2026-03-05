"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { PrismFluxLoader } from "@/components/ui/prism-flux-loader";
import styles from "./SignInFlow.module.css";

interface SignInFlowProps {
  hasSession: boolean;
}

export function SignInFlow({ hasSession }: SignInFlowProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationLabel, setNavigationLabel] = useState("Переходим");
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topLinks = hasSession
    ? [
        { href: "/guide", label: "Быстрый старт" },
        { href: "/billing", label: "Тарифы" },
        { href: "/dashboard", label: "Панель" },
      ]
    : [
        { href: "/login", label: "Вход" },
        { href: "/register", label: "Регистрация" },
        { href: "/login?next=/dashboard", label: "Демо" },
      ];

  const primaryHref = hasSession ? "/dashboard" : "/login";
  const secondaryHref = hasSession ? "/settings" : "/register";

  const submitTarget = useMemo(() => {
    if (hasSession) {
      return "/dashboard";
    }

    const normalized = email.trim();
    if (!normalized) {
      return "/login";
    }

    return `/login?email=${encodeURIComponent(normalized)}`;
  }, [email, hasSession]);

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  const startNavigation = (target: string, label = "Переходим") => {
    if (isNavigating) {
      return;
    }

    setNavigationLabel(label);
    setIsNavigating(true);
    navigationTimerRef.current = setTimeout(() => {
      router.push(target);
    }, 560);
  };

  const handleLinkNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    target: string,
    label = "Переходим"
  ) => {
    event.preventDefault();
    startNavigation(target, label);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startNavigation(submitTarget, "Подключаем");
  };

  return (
    <main className={styles.page}>
      <div className={styles.dotLayer} aria-hidden />
      <div className={styles.vignette} aria-hidden />

      <header className={styles.navShell}>
        <div className={styles.logoMark} aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>

        <nav className={styles.navLinks}>
          {topLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.navLink}
              onClick={(event) => handleLinkNavigation(event, link.href, "Открываем")}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.navActions}>
          <Link
            href={primaryHref}
            className={styles.navGhostButton}
            onClick={(event) => handleLinkNavigation(event, primaryHref, "Загружаем")}
          >
            {hasSession ? "Панель" : "Вход"}
          </Link>
          <Link
            href={secondaryHref}
            className={styles.navSolidButton}
            onClick={(event) => handleLinkNavigation(event, secondaryHref, "Подготавливаем")}
          >
            {hasSession ? "Настройки" : "Регистрация"}
          </Link>
        </div>
      </header>

      <section className={styles.content}>
        <p className={styles.kicker}>DB CONTROL CENTER</p>
        <h1 className={styles.title}>Добро пожаловать, разработчик</h1>
        <p className={styles.subtitle}>
          Управляем бэкапами, восстановлением и аналитикой PostgreSQL в одном чистом интерфейсе.
        </p>

        <div className={styles.quickActions}>
          <Link
            href={primaryHref}
            className={styles.googleButton}
            onClick={(event) => handleLinkNavigation(event, primaryHref, "Открываем")}
          >
            <span className={styles.googleGlyph}>G</span>
            <span>{hasSession ? "Открыть рабочую панель" : "Войти в систему"}</span>
          </Link>

          <div className={styles.separator}>
            <span />
            <p>или</p>
            <span />
          </div>

          <form onSubmit={handleSubmit} className={styles.emailForm}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="info@company.com"
              aria-label="Email"
            />
            <button type="submit" aria-label="Продолжить">
              <span>-&gt;</span>
            </button>
          </form>
        </div>
      </section>

      {isNavigating && (
        <div className={styles.loaderOverlay}>
          <div className={styles.loaderCard}>
            <PrismFluxLoader size={34} speed={6} textSize={12} />
            <p className={styles.loaderText}>{navigationLabel}...</p>
          </div>
        </div>
      )}
    </main>
  );
}
