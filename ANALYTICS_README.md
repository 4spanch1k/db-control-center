# DB Control Center: Аналитический дашборд

Полнофункциональная система анализа и визуализации данных бэкапов и состояния БД.

## 🚀 Возможности

- 📊 **Интерактивная таблица аналитики** с сортировкой и фильтрацией
- 💾 **Мониторинг размера бэкапов** в реальном времени
- ❤️ **Индикаторы здоровья БД** (зеленый/желтый/красный)
- 📈 **Анализ эффективности** и сэкономленного места
- 🔄 **Автоматический сбор данных** через n8n
- 🎨 **Поддержка темной/светлой темы** с CSS переменными
- 📱 **Responsive дизайн** для мобильных устройств

## 📋 Требования

- Node.js 18+
- PostgreSQL 12+
- n8n (для автоматического сбора данных)
- S3/MinIO (для хранения бэкапов)

## 🛠️ Установка

### 1. Подготовка базы данных

Выполните SQL скрипты для создания таблиц и функций:

```bash
# Подключитесь к PostgreSQL
psql -h localhost -U postgres -d control_center

# Выполните скрипты в порядке:
\i sql/001_create_analytics_stats_table.sql
\i sql/002_create_backup_logs_table.sql
\i sql/003_analytics_queries.sql
```

Или используйте Docker:

```bash
docker exec -it db-control-center-postgres psql -U postgres -d control_center < sql/001_create_analytics_stats_table.sql
docker exec -it db-control-center-postgres psql -U postgres -d control_center < sql/002_create_backup_logs_table.sql
docker exec -it db-control-center-postgres psql -U postgres -d control_center < sql/003_analytics_queries.sql
```

### 2. Конфигурация окружения

Создайте файл `.env.local`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=control_center
DB_USER=postgres
DB_PASSWORD=postgres

# Analytics API
ANALYTICS_API_URL=http://localhost:3000

# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Установка зависимостей

```bash
cd web-ui
npm install
```

### 4. Запуск приложения

```bash
# Development режим
npm run dev

# Production build
npm run build
npm start
```

Приложение будет доступно по адресу: `http://localhost:3000`

## 📊 Использование

### Просмотр аналитики

1. Откройте браузер: `http://localhost:3000`
2. Перейдите на страницу "📊 Аналитика"
3. Используйте фильтры периода для просмотра данных

### Структура страницы

```
┌─────────────────────────────────────────┐
│         Заголовок и контролы            │
├─────────────────────────────────────────┤
│         Главные метрики (6 карточек)    │
├─────────────────────────────────────────┤
│         Таблица аналитики (30 строк)    │
├─────────────────────────────────────────┤
│      Анализ эффективности (4 карточки)  │
└─────────────────────────────────────────┘
```

## n8n конфигурация

### Импорт workflow

1. Откройте n8n: `http://localhost:5678`
2. Создайте новый workflow
3. Импортируйте JSON из `n8n-workflows/analytics-workflow.json`
4. Конфигурируйте подключения:
   - PostgreSQL: подробнее в [DATA_COLLECTION_WORKFLOW.md](n8n-workflows/DATA_COLLECTION_WORKFLOW.md#step-3-collection-postgresql-data)
   - S3/MinIO: подробнее в [DATA_COLLECTION_WORKFLOW.md](n8n-workflows/DATA_COLLECTION_WORKFLOW.md#step-4-collection-s3minio-data)

### Настройка расписания

- **По умолчанию**: каждый час
- **Переменные окружения**: `ANALYTICS_API_URL`
- **Обработка ошибок**: встроенная (логирование и повторные попытки)

See complete guide: [n8n-workflows/DATA_COLLECTION_WORKFLOW.md](n8n-workflows/DATA_COLLECTION_WORKFLOW.md)

## 🔧 API Endpoints

### Получение данных

```bash
# Последние 30 записей
GET /api/analytics/recent

# Текущее состояние
GET /api/analytics/current

# Сводка для дашборда
GET /api/analytics/summary

# Анализ эффективности
GET /api/analytics/delta

# Статистика за период
GET /api/analytics/statistic?period=1%20day

# Здоровье БД
GET /api/analytics/health

# Последняя запись
GET /api/analytics/record
```

### Запись данных

```bash
# Создать новую запись аналитики
POST /api/analytics/record

Body:
{
  "total_backups_size": 1234567890,
  "backups_count": 10,
  "db_tables_count": 25,
  "indexes_size": 987654321,
  "active_connections": 5,
  "db_size": 5000000000
}
```

## 📁 Структура проекта

```
db-control-center/
├── sql/
│   ├── 001_create_analytics_stats_table.sql
│   ├── 002_create_backup_logs_table.sql
│   └── 003_analytics_queries.sql
├── n8n-workflows/
│   ├── DATA_COLLECTION_WORKFLOW.md
│   └── analytics-workflow.json
├── web-ui/
│   ├── src/
│   │   ├── app/
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx          # Страница дашборда
│   │   │   ├── api/
│   │   │   │   └── analytics/        # API endpoints
│   │   │   ├── globals.css
│   │   │   ├── variables.css         # CSS переменные
│   │   │   ├── utilities.css         # Утилиты
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── AnalyticsDashboard.tsx
│   │   │   ├── AnalyticsTable.tsx
│   │   │   └── MetricsCard.tsx
│   │   └── lib/
│   │       ├── db.ts                 # Работа с БД
│   │       └── types.ts              # TypeScript типы
│   └── package.json
└── README.md
```

## 🎨 Темы и стили

### Включение темной темы

```html
<!-- Светлая тема (по умолчанию) -->
<html>

<!-- Темная тема -->
<html data-theme="dark">
```

### CSS переменные

Все цвета и размеры определены через CSS переменные в [variables.css](web-ui/src/app/variables.css):

```css
/* Основные цвета */
--color-primary: #3b82f6;
--color-success: #10b981;
--color-warning: #f59e0b;
--color-danger: #ef4444;

/* Темная тема */
--color-bg: #0f172a;
--color-text: #f1f5f9;
```

## 🔍 Возможные проблемы

### 1. Таблица "analytics_stats" не создана

```bash
ERROR: relation "analytics_stats" does not exist
```

**Решение**: Выполните SQL скрипт 001:

```sql
psql -h localhost -U postgres -d control_center < sql/001_create_analytics_stats_table.sql
```

### 2. Данные не загружаются из API

**Проверка**:
- Убедитесь, что PostgreSQL запущен
- Проверьте переменные окружения в `.env.local`
- Посмотрите логи Next.js: `npm run dev`

### 3. n8n не может подключиться к PostgreSQL

**Решение**:
- Убедитесь, что PostgreSQL доступна по хосту/порту
- Проверьте учетные данные в n8n
- Для Docker: используйте имя сервиса вместо localhost

### 4. S3/MinIO не найден

**Решение**:
- Убедитесь, что S3/MinIO запущен
- Проверьте endpoint в n8n workflow
- Для локального MinIO обычно: `http://localhost:9000`

## 📚 Дополнительные ресурсы

- [SQL Функции](sql/003_analytics_queries.sql) - описание всех шести функций
- [n8n Documentation](https://docs.n8n.io/) - подробнее о n8n
- [PostgreSQL Docs](https://www.postgresql.org/docs/) - справка PostgreSQL
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction) - про API маршруты

## 🚀 Оптимизация для продакшена

### 1. Кэширование

```typescript
// Добавьте Redis для кэширования часто используемых данных
const cacheKey = `analytics:summary:${new Date().getHours()}`;
```

### 2. Индексы БД

```sql
-- Уже созданы в скрипте, но можно добавить больше для оптимизации
CREATE INDEX idx_analytics_stats_active_connections 
ON analytics_stats(active_connections);
```

### 3. Партионирование

```sql
CREATE TABLE analytics_stats_2024_01 PARTITION OF analytics_stats
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `docker logs <container-id>`
2. Проверьте статус сервисов: `docker ps`
3. Посмотрите подробное описание проблемы в документации

## 📄 Лицензия

MIT

---

**Автор**: GitHub Copilot  
**Версия**: 1.0.0  
**Последнее обновление**: 2025-02-27
