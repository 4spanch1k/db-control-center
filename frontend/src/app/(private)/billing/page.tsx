"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card/Card";
import styles from "./page.module.css";

interface BillingPlan {
  code: string;
  name: string;
  description?: string | null;
  price_monthly_cents: number;
  currency: string;
  is_active: boolean;
}

interface BillingCurrent {
  current_plan?: BillingPlan | null;
  subscription?: {
    status: string;
    provider: string;
    current_period_start?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end: boolean;
    plan_code: string;
    plan_name: string;
  } | null;
}

function formatPrice(cents: number, currency: string): string {
  if (cents <= 0) {
    return "Free";
  }
  const value = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(value);
}

export default function BillingPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [current, setCurrent] = useState<BillingCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPlanCode, setPendingPlanCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "success") {
      setMessage("Оплата подтверждена. Обновляем тариф...");
    } else if (status === "cancel") {
      setMessage("Оплата отменена.");
    } else if (status === "free") {
      setMessage("Активирован тариф Free.");
    }
  }, []);

  const loadBillingData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [plansResponse, currentResponse] = await Promise.all([
        fetch("/api/billing/plans", { method: "GET", credentials: "same-origin" }),
        fetch("/api/billing/current", { method: "GET", credentials: "same-origin" }),
      ]);

      const plansPayload = await plansResponse.json();
      const currentPayload = await currentResponse.json();

      if (!plansResponse.ok || !plansPayload?.success) {
        throw new Error(plansPayload?.detail || "Не удалось загрузить тарифы");
      }
      if (!currentResponse.ok || !currentPayload?.success) {
        throw new Error(currentPayload?.detail || "Не удалось загрузить текущую подписку");
      }

      setPlans(plansPayload.data || []);
      setCurrent({
        current_plan: currentPayload.current_plan,
        subscription: currentPayload.subscription,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки Billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.price_monthly_cents - b.price_monthly_cents),
    [plans]
  );

  const planHint = (code: string): string => {
    if (code === "max") return "Безлимитный доступ ко всем ручным операциям.";
    if (code === "pro") return "Расширенные лимиты для активной ежедневной работы.";
    return "Базовые лимиты для старта и тестирования.";
  };

  const handleCheckout = async (planCode: string) => {
    setPendingPlanCode(planCode);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ plan_code: planCode }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.detail || payload?.message || "Не удалось создать checkout");
      }

      if (payload.checkout_url) {
        window.location.href = payload.checkout_url;
        return;
      }

      setMessage(payload.message || "Тариф обновлен");
      await loadBillingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка запуска checkout");
    } finally {
      setPendingPlanCode(null);
    }
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Тариф и подписка</h1>

      <Card>
        <CardHeader>
          <CardTitle>Текущий доступ</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className={styles.muted}>Загрузка...</p>}
          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}

          {!loading && !error && current && (
            <div className={styles.currentWrap}>
              <div className={styles.currentLine}>
                <span className={styles.key}>План:</span>
                <span className={styles.value}>{current.current_plan?.name || "Не определен"}</span>
              </div>
              {current.subscription && (
                <div className={styles.currentLine}>
                  <span className={styles.key}>Статус подписки:</span>
                  <span className={styles.value}>
                    {current.subscription.status} ({current.subscription.provider})
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <section className={styles.grid}>
        {sortedPlans.map((plan) => {
          const isCurrent = current?.current_plan?.code === plan.code;
          const isPending = pendingPlanCode === plan.code;
          return (
            <Card key={plan.code}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={styles.price}>{formatPrice(plan.price_monthly_cents, plan.currency)} / month</p>
                <p className={styles.desc}>{plan.description || "Без описания"}</p>
                <p className={styles.planRole}>{planHint(plan.code)}</p>
                <button
                  className={styles.button}
                  type="button"
                  onClick={() => handleCheckout(plan.code)}
                  disabled={isCurrent || isPending || loading}
                >
                  {isCurrent ? "Текущий план" : isPending ? "Обработка..." : "Выбрать"}
                </button>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
