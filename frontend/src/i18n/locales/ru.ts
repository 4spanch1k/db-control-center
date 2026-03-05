import type { LocaleDictionary } from "./en";

export const ru: LocaleDictionary = {
  common: {
    language: "Язык",
    loading: "Загрузка...",
  },
  settings: {
    title: "Настройки",
    subtitle:
      "Шаг 1: подключите свою PostgreSQL базу. После успешной проверки система сохранит конфигурацию.",
    preferencesTitle: "Предпочтения",
    languageTitle: "Язык",
    languageHelp: "Изменения применяются сразу и сохраняются для следующей сессии.",
    languageOptionEnglish: "Английский",
    languageOptionRussian: "Русский",
    connectionWizardTitle: "Мастер подключения БД",
    fieldConnectionName: "Название подключения",
    fieldDbType: "Тип БД",
    fieldDbTypePostgres: "PostgreSQL",
    fieldPort: "Порт",
    fieldHost: "Хост",
    fieldDatabaseName: "База данных",
    fieldUsername: "Пользователь",
    fieldPassword: "Пароль",
    submitIdle: "Проверить и сохранить",
    submitLoading: "Проверяем...",
    connectionSaved:
      "Подключение проверено и сохранено. Теперь можно делать бэкапы на дашборде.",
    connectionTestError: "Не удалось проверить подключение",
    connectionErrorGeneric: "Ошибка подключения",
  },
};
