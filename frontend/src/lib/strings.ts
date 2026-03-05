/**
 * Единый словарь системных строк UI.
 *
 * Все пользовательские сообщения (тосты, баннеры, плейсхолдеры ошибок)
 * должны браться отсюда, чтобы не было разброса по компонентам.
 */

export const S = {
  /* ─── Dashboard ─── */
  dashboard: {
    backupCreated: "Бэкап успешно создан!",
    backupSending: "Отправка команды воркеру... (подождите)",
    backupError: "Ошибка при создании бэкапа.",
    restorePreparing: "Подготовка безопасного восстановления...",
    restoreStarted: "Восстановление запущено. Статус операции появится в истории.",
    restoreError: "Ошибка запуска восстановления.",
    restorePrepareError: "Ошибка подготовки восстановления.",
    verifyRunning: "Запуск проверки бэкапа...",
    verifySuccess: "Проверка бэкапа завершена успешно.",
    verifyPartial: "Проверка завершена с предупреждениями.",
    verifyError: "Проверка бэкапа завершилась ошибкой.",
    rateLimitExceeded: "Дневной лимит тарифа исчерпан. Перейдите на более высокий план.",
    serverUnavailable: "Не удалось связаться с сервером.",
    emptyStateFlow: "Подключите БД → настройте бэкапы → сделайте первый бэкап",
    emptyStateHelp: "Когда появится первый бэкап, здесь отобразятся действия проверки, восстановления и история запусков.",
    demoGuideTitle: "Подсказки демо",
    demoGuideHint: "Кнопка «Запустить демо» подсветит следующие действия в правильном порядке.",
    demoStart: "Запустить демо",
    demoStop: "Остановить демо",
    demoStepConnect: "1. Подключить БД в «Настройках»",
    demoStepBackup: "2. Настроить профиль и сделать бэкап",
    demoConnectionMissing: "Подключение к целевой БД не найдено. Начните со шага 1.",
    demoConnectionReady: "Подключение найдено. Переходите к профилям и созданию первого бэкапа.",
  },

  /* ─── Cleanup ─── */
  cleanup: {
    confirmTitle: "Удалить бэкапы?",
    confirmDescription: "Старые бэкапы будут удалены из хранилища. Действие необратимо.",
    confirmWarning: "Удалённые файлы невозможно восстановить.",
    confirmWord: "УДАЛИТЬ",
    confirmButton: "Удалить бэкапы",
    started: "Очистка запущена! Отчёт придёт в Telegram",
    error: "Ошибка при запуске очистки",
    serverUnavailable: "Не удалось связаться с сервером",
  },

  /* ─── Billing ─── */
  billing: {
    paymentConfirmed: "Оплата подтверждена. Обновляем тариф...",
    paymentCancelled: "Оплата отменена.",
    freePlanActivated: "Активирован тариф Free.",
    planUpdated: "Тариф обновлён",
    loadPlansError: "Не удалось загрузить тарифы",
    loadSubscriptionError: "Не удалось загрузить текущую подписку",
    loadError: "Ошибка загрузки тарифов",
    checkoutError: "Не удалось создать checkout",
    checkoutStartError: "Ошибка запуска checkout",
  },

  /* ─── Users ─── */
  users: {
    roleUpdated: "Роль пользователя обновлена",
    statusUpdated: "Статус пользователя обновлён",
    loadError: "Не удалось загрузить пользователей",
    loadErrorGeneric: "Ошибка загрузки",
    roleUpdateError: "Не удалось обновить роль",
    roleUpdateErrorGeneric: "Ошибка обновления роли",
    statusUpdateError: "Не удалось обновить статус",
    statusUpdateErrorGeneric: "Ошибка обновления статуса",
    statusActive: "Активен",
    statusInactive: "Неактивен",
    deactivateConfirmTitle: "Деактивировать пользователя?",
    deactivateConfirmButton: "Деактивировать",
    deactivateConfirmWord: "ОТКЛЮЧИТЬ",
  },

  /* ─── Settings ─── */
  settings: {
    connectionSaved: "Подключение проверено и сохранено. Теперь можно делать бэкапы на дашборде.",
    connectionTestError: "Не удалось проверить подключение",
    connectionErrorGeneric: "Ошибка подключения",
  },

  /* ─── Audit ─── */
  audit: {
    loadError: "Не удалось загрузить аудит-логи",
    loadErrorGeneric: "Ошибка загрузки",
  },

  /* ─── Auth ─── */
  auth: {
    invalidCredentials: "Неверный email или пароль",
    authError: "Ошибка авторизации",
    passwordTooShort: "Пароль должен содержать минимум 8 символов",
    passwordsMismatch: "Пароли не совпадают",
    registerError: "Не удалось зарегистрировать пользователя",
    registerErrorGeneric: "Ошибка регистрации",
  },

  /* ─── Analytics ─── */
  analytics: {
    summaryLoadError: "Ошибка загрузки итогов",
    deltaLoadError: "Ошибка загрузки дельты",
    historyLoadError: "Ошибка загрузки истории",
    connectionError: "Ошибка подключения",
    unknownError: "Неизвестная ошибка",
  },

  /* ─── Common ─── */
  common: {
    serverError: "Внутренняя ошибка сервера",
    serviceUnavailable: "Сервис недоступен",
  },
} as const;
