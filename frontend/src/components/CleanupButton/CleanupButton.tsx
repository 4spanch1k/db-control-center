"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import styles from "./CleanupButton.module.css";

type CleanupState = "idle" | "loading" | "success" | "error";

interface CleanupButtonProps {
  onSuccess?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

export default function CleanupButton({
  onSuccess,
  disabled = false,
  disabledReason,
}: CleanupButtonProps) {
  const [state, setState] = useState<CleanupState>("idle");
  const [message, setMessage] = useState<string>("");

  const handleCleanup = async () => {
    if (disabled) {
      return;
    }
    setState("loading");
    setMessage("");

    try {
      const response = await fetch("/api/cleanup/trigger", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success || response.ok) {
        setState("success");
        setMessage(data.message || "Очистка запущена! Отчёт придёт в Telegram");
        if (onSuccess) {
          onSuccess();
        }
        // Автоматически вернуться в исходное состояние через 5 секунд
        setTimeout(() => {
          setState("idle");
          setMessage("");
        }, 5000);
      } else {
        setState("error");
        setMessage(data.message || "Ошибка при запуске очистки");
      }
    } catch (error) {
      setState("error");
      setMessage("Не удалось связаться с сервером");
      console.error("Cleanup request error:", error);
    }
  };

  return (
    <div>
      <button
        className={styles.cleanupButton}
        onClick={handleCleanup}
        disabled={state === "loading" || disabled}
        title={disabled ? disabledReason : undefined}
      >
        {state === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        {state === "loading" ? "Запуск очистки..." : "Очистить бэкапы"}
      </button>

      {disabled && disabledReason && (
        <div className={styles.disabledHint}>{disabledReason}</div>
      )}

      {message && (
        <div
          className={`${styles.cleanupMessage} ${state === "success"
            ? styles.cleanupMessageSuccess
            : state === "error"
              ? styles.cleanupMessageError
              : styles.cleanupMessageLoading
            }`}
        >
          {state === "success" && <CheckCircle2 size={18} />}
          {state === "error" && <AlertTriangle size={18} />}
          {message}
        </div>
      )}
    </div>
  );
}
