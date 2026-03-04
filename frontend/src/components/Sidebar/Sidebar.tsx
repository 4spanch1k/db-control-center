"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart, BookOpen, CreditCard, Database, LogOut, Settings, type LucideIcon } from "lucide-react";
import styles from "./Sidebar.module.css";

type PlanCode = "free" | "pro" | "max";
type MenuItem = { label: string; href: string; icon: LucideIcon };

const menuItems: MenuItem[] = [
  { label: "Обзор", href: "/dashboard", icon: Database },
  { label: "Аналитика", href: "/analytics", icon: BarChart },
  { label: "Как пользоваться", href: "/guide", icon: BookOpen },
  { label: "Тариф", href: "/billing", icon: CreditCard },
  { label: "Настройки", href: "/settings", icon: Settings },
];

function normalizePlanCode(raw: unknown): PlanCode {
  if (raw === "pro" || raw === "max" || raw === "free") {
    return raw;
  }
  return "free";
}

function planLabel(plan: PlanCode): string {
  if (plan === "max") return "MAX";
  if (plan === "pro") return "PRO";
  return "FREE";
}

export default function Sidebar() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanCode>("free");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const loadSessionData = async () => {
      try {
        const [meResponse, billingResponse] = await Promise.all([
          fetch("/api/auth/me", { method: "GET", credentials: "same-origin" }),
          fetch("/api/billing/current", { method: "GET", credentials: "same-origin" }),
        ]);

        if (meResponse.ok) {
          const meData = await meResponse.json();
          if (isMounted) {
            setUserEmail(meData?.user?.email ?? null);
          }
        } else if (isMounted) {
          setUserEmail(null);
        }

        if (billingResponse.ok) {
          const billingData = await billingResponse.json();
          if (isMounted) {
            const code = billingData?.current_plan?.code ?? billingData?.subscription?.plan_code;
            setCurrentPlan(normalizePlanCode(code));
          }
        }
      } catch {
        if (isMounted) {
          setUserEmail(null);
          setCurrentPlan("free");
        }
      }
    };

    loadSessionData();
    return () => {
      isMounted = false;
    };
  }, []);

  const planText = useMemo(() => planLabel(currentPlan), [currentPlan]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      setIsLoggingOut(false);
      router.push("/");
      router.refresh();
    }
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.brandArea}>
        <Link href="/dashboard" className={styles.brand} title="DB Control Center">
          <Database size={18} />
          <span>DB Control Center</span>
        </Link>
      </div>

      <nav className={styles.nav} aria-label="Основная навигация">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const cleanHref = item.href.split("#")[0];
          const isActive = cleanHref === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(cleanHref);
          return (
            <Link key={item.label} href={item.href} className={`${styles.navItem} ${isActive ? styles.active : ""}`}>
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.sessionArea}>
        <span className={styles.planBadge}>{planText}</span>
        <span className={styles.userEmail}>{userEmail ?? "Пользователь"}</span>
        <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={isLoggingOut}>
          <LogOut size={16} />
          <span>{isLoggingOut ? "Выход..." : "Выход"}</span>
        </button>
      </div>
    </header>
  );
}
