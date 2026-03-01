# 🛡️ DB Control Center

**DB Control Center** — это отказоустойчивая Fullstack-система для автоматизации резервного копирования, восстановления баз данных и аналитического мониторинга. Проект объединяет современный веб-интерфейс, мощный движок автоматизации, облачное хранилище и продвинутый дашборд аналитики в единую экосистему.

## 🚀 Основные возможности

### Управление бэкапами
* **One-Click Backup**: Мгновенное создание дампа базы данных PostgreSQL через веб-интерфейс
* **S3-Compatible Storage**: Надежное хранение бэкапов в объектном хранилище **MinIO**
* **Smart Restore**: Система восстановления данных в один клик с автоматической очисткой старых таблиц
* **Telegram Alerts**: Мгновенные уведомления в ваш карман о статусе каждой операции через Telegram Bot API
* **Audit History**: Полная история всех действий с метаданными в реальном времени

### Аналитический дашборд
* 📊 **Интерактивная таблица аналитики** с сортировкой, фильтрацией и кликабельными строками
* 💾 **Мониторинг в реальном времени**: размер бэкапов, здоровье БД, активные подключения
* ❤️ **Индикаторы здоровья** с визуальной индикацией (зеленый/желтый/красный статус)
* 📈 **Анализ эффективности**: расчет сэкономленного места, сравнение объемов
* 🔄 **Автоматический сбор данных** через Python backend (каждый час)
* 🎨 **Темная/светлая тема** с полной поддержкой CSS переменных
* 📱 **Responsive дизайн** для мобильных и планшетов

## 🛠 Технологический стек

* **Frontend**: Next.js 16, React 19, TypeScript, CSS Modules с переменными
* **Backend**: Python 3.11, FastAPI 0.104.1, APScheduler 3.10.4
* **Database Driver**: asyncpg 0.29.0 (асинхронный пул соединений)
* **Storage**: MinIO (S3-compatible) с boto3
* **Database**: PostgreSQL 12+ с хранимыми функциями
* **AlertS**: Telegram Bot API для уведомлений
* **Infrastructure**: Docker & Docker Compose

## 📊 Архитектура системы

```
┌─────────────────────────────────────────────────┐
│         Web UI (Next.js + React)                │
│  ┌──────────────────────────────────────────┐  │
│  │   Управление       │    Аналитика       │  │
│  │  - Backup          │  - Дашборд         │  │
│  │  - Restore         │  - Таблица метрик  │  │
│  │  - Cleanup         │  - Графики         │  │
│  └──────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │
   ┌───────────────┼───────────────┐
   │               │               │
   ▼               ▼               ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────┐
│  Python Backend │ │  PostgreSQL  │ │  MinIO   │
│ - FastAPI       │ │  - Statistics│ │ - Backups│
│ - APScheduler   │ │  - History   │ │          │
│ - Telegram      │ │  - Analytics │ │          │
└─────────────────┘ └──────────────┘ └──────────┘
     │ Hourly Analytics (minute=0)
     │ Daily Cleanup (02:00 UTC)
     └─► Telegram Notifications
```

## 📁 Структура проекта

```
db-control-center/
├── sql/                           # SQL скрипты
│   ├── 001_create_analytics_stats_table.sql
│   ├── 002_create_backup_logs_table.sql
│   └── 003_analytics_queries.sql
├── python-backend/                # Python FastAPI Server
│   ├── main.py                    # FastAPI приложение + APScheduler
│   ├── db_manager.py              # AsyncPG для PostgreSQL
│   ├── s3_manager.py              # Boto3 для MinIO/S3
│   ├── telegram_alerts.py         # Telegram notifications
│   ├── requirements.txt           # Python зависимости
│   ├── Dockerfile                 # Python 3.11 контейнер
│   └── __init__.py
├── frontend/                        # Next.js приложение
│   ├── src/
│   │   ├── app/
│   │   │   ├── analytics/         # Страница дашборда
│   │   │   ├── api/
│   │   │   │   ├── cleanup/trigger/    # Прокси на Python backend
│   │   │   │   └── analytics/collect/  # Сбор метрик
│   │   │   ├── variables.css      # CSS переменные
│   │   │   ├── utilities.css      # CSS утилиты
│   │   │   └── page.tsx           # Главная страница
│   │   ├── components/
│   │   │   ├── AnalyticsDashboard.tsx    # Главный компонент
│   │   │   ├── AnalyticsTable.tsx        # Таблица метрик
│   │   │   ├── MetricsCard.tsx           # Карточка метрики
│   │   │   └── CleanupButton.tsx
│   │   └── lib/
│   │       ├── db.ts              # Интеграция PostgreSQL
│   │       └── types.ts           # TypeScript типы
│   ├── Dockerfile
│   └── package.json
├── DEPLOYMENT.md                  # Инструкции развертывания
├── PYTHON_BACKEND_MIGRATION.md    # Миграция с n8n
├── ANALYTICS_README.md            # Подробное руководство
├── ARCHITECTURE.md                # Архитектурные решения
├── .env.example                   # Шаблон переменных
├── docker-compose.yml
└── README.md (вы здесь)
```

## 🚀 Быстрый запуск

### За 3 команды к работающей системе:

```bash
# 1. Конфигурация
cp .env.example .env.local
# Отредактируйте .env.local (заполните DB пароли, Telegram опционально)

# 2. Развертывание Docker контейнеров
docker-compose down -v
docker-compose up -d

# 3. Открыть в браузере
open http://localhost:3000/analytics
```

**Проверить здоровье систем:**

```bash
# Python backend
curl http://localhost:8000/health

# Next.js приложение
curl http://localhost:3000
```

Подробнее: 📖 [DEPLOYMENT.md](DEPLOYMENT.md)

## 🧭 Developer Workflow

Единая точка входа для разработки:

```bash
make help
make bootstrap
make dev
make lint
make verify
make test
make migrate-up
make seed-admin ADMIN_PASSWORD="change_me"
```

`make bootstrap` создаёт локальное Python-окружение `.venv` и устанавливает backend зависимости туда.
`make verify` выполняет полный цикл проверки: `lint + backend-tests + frontend-build` (`make test` — алиас).

Подробности: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## 📊 Функциональность Python Backend

### REST API Endpoints

```bash
# Проверить здоровье системы
GET http://localhost:8000/health

# Ручной запуск очистки старых бэкапов
POST http://localhost:8000/api/trigger-cleanup

# Ручной сбор аналитики
POST http://localhost:8000/api/trigger-analytics

# Информация о приложении
GET http://localhost:8000/
```

### Автоматические Scheduled Jobs

```
┌─ Каждый час (в 0 минут)
│  └─ Сбор аналитики БД
│     - Количество таблиц
│     - Размер БД и индексов
│     - Активные подключения
│     - Размер и количество бэкапов
│     └─ Сохранение в PostgreSQL + Telegram уведомление

└─ Ежедневно в 02:00 UTC
   └─ Удаление старых бэкапов (старше 7 дней)
      - Удаление файлов из MinIO
      - Логирование операции в БД
      - Отправка отчета в Telegram
```

### Frontend API Routes (прокси на Python backend)

```bash
# Next.js прокси для очистки
POST http://localhost:3000/api/cleanup/trigger

# Next.js прокси для аналитики
POST http://localhost:3000/api/analytics/collect
```

## 🎨 Кастомизация

### Темы

```typescript
// Светлая тема (по умолчанию)
<html>

// Темная тема
<html data-theme="dark">
```

### CSS Переменные

Все цвета и размеры определены через CSS переменные в [variables.css](frontend/src/app/variables.css):

```css
--color-primary: #3b82f6;
--color-success: #10b981;
--color-warning: #f59e0b;
--color-danger: #ef4444;
--font-size-xl: 1.25rem;
/* и более 50 переменных... */
```

## 🔧 Конфигурация Python Backend

Python backend использует переменные окружения для конфигурации:

```bash
# Database
DB_HOST=metadata-postgres
DB_PORT=5432
DB_NAME=control_center
DB_USER=postgres
DB_PASSWORD=postgres

# Python Backend
LOG_LEVEL=INFO
ENV=production
AUTO_APPLY_MIGRATIONS=true
MIGRATION_TIMEOUT_SEC=120

# MinIO/S3
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=backups
MINIO_USE_SSL=false

# Telegram (опционально)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Backup Retention
BACKUP_RETENTION_DAYS=7
```

Все переменные загружаются из `.env` файла при запуске контейнера.

### Изменение расписания jobs

Отредактируйте [python-backend/main.py](python-backend/main.py):

```python
# Изменить время сбора аналитики (по умолчанию каждый час)
scheduler.add_job(collect_analytics_job, 'cron', minute=0)

# Изменить время очистки (по умолчанию 02:00 UTC)
scheduler.add_job(cleanup_backups_job, 'cron', hour=2, minute=0)
```

Подробнее: 📖 [PYTHON_BACKEND_MIGRATION.md](PYTHON_BACKEND_MIGRATION.md)

## 🏗️ Архитектура

Проект использует **High Reasoning** подход для обработки ошибок:

```
ERROR SCENARIO
├─ DETECTION: мониторинг и логирование
├─ IMMEDIATE ACTION: попытка восстановления
├─ RECOVERY: использование fallback механизмов
└─ FALLBACK: кэшированные данные
```

Подробнее: 📖 [ARCHITECTURE.md](ARCHITECTURE.md)

## 💾 Хранилище данных

### PostgreSQL таблицы

| Таблица | Назначение |
|---------|-----------|
| `analytics_stats` | Основные метрики (часовые снимки) |
| `backup_deletion_logs` | Логи удаленных бэкапов |
| `analytics_saved_space` (VIEW) | Расчет сэкономленного места |

### Индексы

```sql
-- Быстрый поиск по времени
CREATE INDEX idx_analytics_stats_timestamp ON analytics_stats(timestamp DESC);
```

## 🐛 Решение проблем

### "relation analytics_stats does not exist"
```bash
psql -h localhost -U postgres -d control_center < sql/001_create_analytics_stats_table.sql
```

### "No data available"
Добавьте тестовые данные:
```bash
psql -h localhost -U postgres -d control_center << SQL
SELECT insert_analytics_stats(5368709120, 10, 45, 2147483648, 12, 10737418240);
SQL
```

### "Cannot connect to database"
Проверьте:
1. PostgreSQL запущен
2. .env.local содержит правильные учетные данные
3. БД `control_center` существует

Полный список решений: 📖 [ANALYTICS_README.md#troubleshooting](ANALYTICS_README.md)

## 📚 Документация

| Документ | Описание |
|----------|---------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Развертывание и управление системой |
| [PYTHON_BACKEND_MIGRATION.md](PYTHON_BACKEND_MIGRATION.md) | Миграция с n8n на Python backend |
| [ANALYTICS_README.md](ANALYTICS_README.md) | Подробное руководство по аналитике |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Архитектурные решения и обработка ошибок |

## 📈 Метрики дашборда

- **Бэкапы**: количество и общий размер
- **Размер бэкапов**: в человекочитаемом формате (GB, MB, KB)
- **Сэкономлено**: удаленные объемы и процент эффективности
- **Таблицы БД**: количество структур данных
- **Здоровье БД**: процент здоровья (0-100%)
- **Подключения**: активные соединения к БД

## 🔐 Безопасность

- Все данные валидируются на входе
- SQL инъекции предотвращены параметризованными запросами
- Чувствительные данные в `.env.local` (не в git)
- CORS защита включена

## 🚀 Развитие проекта

### Планируемые функции
- [ ] Real-time обновления через WebSocket
- [ ] Экспорт данных в CSV/JSON
- [ ] Предсказание объемов через ML
- [ ] Обнаружение аномалий
- [ ] Интеграция с Slack/Email

## 👨‍💻 Развертывание

### Docker

```bash
docker-compose up -d
```

### Kubernetes (будущее)

```bash
kubectl apply -f k8s/
```

## 👥 Контрибьютинг

Мы приветствуем код-ревью и пул-реквесты. Перед внесением изменений:

1. Создайте фичевую ветку: `git checkout -b feature/amazing-feature`
2. Закоммитьте изменения: `git commit -m 'Add amazing feature'`
3. Запустите тесты: `npm run test`
4. Создайте Pull Request

## 📄 Лицензия

MIT - см. файл [LICENSE](LICENSE)

## 👨‍💻 Автор

**Разработано**: aspanch1k  
**Версия**: 1.0.0  
**Последнее обновление**: 2025-02-27

Система демонстрирует навыки работы с:
- Docker-контейнеризацией и orchestration
- Микросервисной архитектурой
- Full-stack разработкой (React + Node.js + PostgreSQL)
- Автоматизацией бизнес-процессов (n8n)
- DevOps и CI/CD

## 🤝 Поддержка

Если возникли вопросы или проблемы:

1. 📖 Проверьте документацию выше
2. 🐛 Посмотрите раздел "Решение проблем"
3. 💬 Откройте Issue на GitHub

---

## 🎯 Возможности система на сегодня

✅ One-Click Резервное копирование  
✅ Восстановление из любого бэкапа  
✅ Мониторинг состояния БД в реальном времени  
✅ История всех операций  
✅ Аналитический дашборд  
✅ Автоматический сбор метрик через Python backend (каждый час)  
✅ Автоматическая очистка старых бэкапов (ежедневно)  
✅ Telegram уведомления  
✅ Поддержка темной/светлой темы  
✅ Responsive дизайн  
✅ Asynchronous операции (asyncpg, httpx, boto3)  
✅ Production-ready с полной обработкой ошибок  

**Готово к использованию! 🎉**
