# Быстрый старт - DB Control Center Analytics

## ⚡ За 5 минут к дашборду

### Шаг 1: Подготовка БД (1 мин)

```bash
# Подключиться и выполнить SQL
cd /Users/aspanch1k/db-control-center
psql -h localhost -U postgres -d control_center < sql/001_create_analytics_stats_table.sql
psql -h localhost -U postgres -d control_center < sql/002_create_backup_logs_table.sql
psql -h localhost -U postgres -d control_center < sql/003_analytics_queries.sql
```

### Шаг 2: Конфигурация приложения (1 мин)

```bash
# Скопировать шаблон конфигурации
cp .env.example .env.local

# Отредактировать необходимые значения
cat > web-ui/.env.local << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=control_center
DB_USER=postgres
DB_PASSWORD=postgres
NEXT_PUBLIC_API_URL=http://localhost:3000
EOF
```

### Шаг 3: Установка зависимостей (1 мин)

```bash
cd web-ui
npm install
```

### Шаг 4: Запуск приложения (1 мин)

```bash
npm run dev
```

### Шаг 5: Открыть в браузере (1 мин)

```
http://localhost:3000/analytics
```

---

## 📊 Первые данные

### Вариант 1: Тестовые данные вручную

```bash
# Вставить тестовые данные в БД
psql -h localhost -U postgres -d control_center << SQL
SELECT insert_analytics_stats(
    5368709120,    -- total_backups_size (5 GB)
    10,            -- backups_count
    45,            -- db_tables_count
    2147483648,    -- indexes_size (2 GB)
    12,            -- active_connections
    10737418240    -- db_size (10 GB)
);
SQL
```

Затем откройте http://localhost:3000/analytics и нажмите F5

### Вариант 2: Через n8n (автоматический сбор)

1. Откройте n8n: http://localhost:5678
2. Импортируйте workflow: `n8n-workflows/analytics-workflow.json`
3. Настройте подключения (см. ниже)
4. Нажмите "Execute workflow"

---

## 🔧 Конфигурация n8n

### Шаг 1: PostgreSQL подключение

```
Connection name: PostgreSQL
Host: localhost
Port: 5432
Database: control_center
User: postgres
Password: postgres
SSL: false (или true если используется)
```

### Шаг 2: S3/MinIO подключение

```
Connection name: S3
Endpoint (для MinIO): http://localhost:9000
Access Key: minioadmin
Secret Key: minioadmin
Bucket: backups
Region: us-east-1
Use SSL: false
```

### Шаг 3: Активизировать workflow

Нажмите кнопку **"Active"** чтобы workflow запускался по расписанию

---

## ✅ Проверка работоспособности

### 1. Проверить API

```bash
# Должна вернуть последнюю запись
curl http://localhost:3000/api/analytics/current

# Должна вернуть последние 30 записей
curl http://localhost:3000/api/analytics/recent

# Должна вернуть сводку
curl http://localhost:3000/api/analytics/summary
```

### 2. Проверить БД

```bash
psql -h localhost -U postgres -d control_center

# Выполнить в psql:
SELECT * FROM analytics_stats ORDER BY timestamp DESC LIMIT 1;
SELECT * FROM get_analytics_recent_30();
SELECT * FROM get_dashboard_summary();
```

### 3. Проверить фронтенд

- Откройте http://localhost:3000
- Перейдите на вкладку "📊 Аналитика"
- Должны отобразиться метрики и таблица

---

## 🐛 Частые проблемы

### Ошибка: "relation analytics_stats does not exist"

```bash
# Решение: заново выполнить SQL скрипты
psql -h localhost -U postgres -d control_center < sql/001_create_analytics_stats_table.sql
```

### Ошибка: "No data available"

```bash
# Либо добавьте тестовые данные:
psql -h localhost -U postgres -d control_center << SQL
SELECT insert_analytics_stats(5368709120, 10, 45, 2147483648, 12, 10737418240);
SQL

# Либо дождитесь первого запуска n8n workflow (по часам)
```

### Ошибка: "Cannot connect to database"

```bash
# Проверьте:
1. PostgreSQL запущен: ps aux | grep postgres
2. Порт слушает: netstat -tulpn | grep 5432
3. .env.local содержит корректные учетные данные
4. БД control_center существует
```

---

## 📝 Следующие шаги

### Для разработки:

1. ✅ Git commit: `git add . && git commit -m "feat: add analytics dashboard"`
2. 📝 Посмотрите [ARCHITECTURE.md](ARCHITECTURE.md) для углубленного понимания
3. 🔄 Прочитайте [n8n-workflows/DATA_COLLECTION_WORKFLOW.md](n8n-workflows/DATA_COLLECTION_WORKFLOW.md)
4. 🎨 Кастомизируйте CSS переменные в [web-ui/src/app/variables.css](web-ui/src/app/variables.css)

### Для продакшена:

1. 🔐 Используйте переменные окружения из `.env.local`
2. 🗄️ Настройте резервное копирование PostgreSQL
3. 📊 Включите мониторинг БД
4. 🔔 Настройте уведомления о сбоях n8n
5. 📈 Добавьте индексы для больших объемов данных

### Для расширения:

1. 📱 Добавьте мобильное приложение
2. 🤖 Включите ML для предсказания
3. 🔔 Slack/Email уведомления об аномалиях
4. 📊 GraphQL API вместо REST
5. 📹 Real-time обновления через WebSocket

---

## 🎓 Учебные ресурсы

- [SQL Functions](sql/003_analytics_queries.sql) - подробный разбор всех функций
- [API Endpoints](web-ui/src/app/api/analytics/) - все endpoint'ы с комментариями
- [React Components](web-ui/src/components/) - структура компонентов
- [n8n Workflow](n8n-workflows/analytics-workflow.json) - JSON конфигурация

---

## 💡 Советы

1. **Дебага в DevTools**: открыть Network tab и смотреть запросы к API
2. **Логи PostgreSQL**: `docker logs <postgres-container> | tail -100`
3. **n8n логи**: откройте страницу workflow и нажмите кнопку "View Logs"
4. **TypeScript проверка**: `cd web-ui && npx tsc --noEmit`

---

**Готово! 🎉 Ваш дашборд работает!**

Если возникли вопросы - смотрите полную документацию:
- [ANALYTICS_README.md](ANALYTICS_README.md) - подробное руководство
- [ARCHITECTURE.md](ARCHITECTURE.md) - архитектурные решения
- [n8n-workflows/DATA_COLLECTION_WORKFLOW.md](n8n-workflows/DATA_COLLECTION_WORKFLOW.md) - n8n workflow
