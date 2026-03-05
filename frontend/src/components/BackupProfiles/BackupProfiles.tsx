"use client";

interface Props {
  connectionId: string;
  selectedProfileId: string | null;
  onSelectProfile: (id: string | null) => void;
}

export default function BackupProfiles({ connectionId, selectedProfileId, onSelectProfile }: Props) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)" }}>
        Профили бэкапов
      </div>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-tertiary)" }}>
        В демо-режиме для подключения `{connectionId}` используется профиль по умолчанию (полный бэкап).
      </p>
      <button
        type="button"
        onClick={() => onSelectProfile(selectedProfileId ? null : "default")}
        style={{
          border: "1px solid var(--color-border)",
          background: "transparent",
          color: "var(--color-text)",
          borderRadius: 10,
          padding: "8px 12px",
          cursor: "pointer",
          fontSize: "0.83rem",
          width: "fit-content",
        }}
      >
        {selectedProfileId ? "Используется профиль: Полный" : "Выбрать профиль: Полный"}
      </button>
    </div>
  );
}
