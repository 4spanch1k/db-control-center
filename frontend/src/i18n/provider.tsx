"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import type { DictionaryShape, Language, TranslationKey } from "./types";

const LANGUAGE_STORAGE_KEY = "dbcc.language";

const dictionaries: Record<Language, DictionaryShape> = {
  en,
  ru,
};

function isLanguage(value: string): value is Language {
  return value === "en" || value === "ru";
}

function getValueByPath(
  source: DictionaryShape,
  key: TranslationKey,
): string | undefined {
  const path = key.split(".");
  let current: unknown = source;

  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : undefined;
}

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && isLanguage(savedLanguage)) {
      setLanguageState(savedLanguage);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const currentLocaleValue = getValueByPath(dictionaries[language], key);
      if (currentLocaleValue) {
        return currentLocaleValue;
      }

      const fallbackValue = getValueByPath(dictionaries.en, key);
      if (fallbackValue) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[i18n] Missing key "${key}" for locale "${language}", fallback to "en".`);
        }
        return fallbackValue;
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] Missing key "${key}" in all locales.`);
      }
      return key;
    },
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function useT() {
  return useI18n().t;
}
