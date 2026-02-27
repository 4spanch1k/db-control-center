# 🏗️ Архитектура DB Control Center (Python Backend)

## Раздел 1: Обработка ошибок в Python Backend

### 1.1 Стратегия восстановления подключений (FastAPI ↔ PostgreSQL)

```
ERROR SCENARIO 1: Python backend потеряет соединение с PostgreSQL
├─ DETECTION: asyncpg Exception, connection pool error (< 1 second)
├─ IMMEDIATE ACTION:
│  ├─ Log error с context и timestamp
│  ├─ asyncpg pool автоматически remove broken connection
│  └─ Попытка acquire нового соединения из pool
├─ RECOVERY: 
│  ├─ max_size=20 позволяет создать новое соединение
│  ├─ min_size=5 гарантирует минимум готовых
│  └─ Retry автоматический при следующем запросе
└─ FALLBACK: Health check вернет degraded status
```

### 1.2 Обработка timeouts в S3Manager

```
ERROR SCENARIO 2: MinIO не отвечает на list_objects_v2
├─ DETECTION: ClientError or timeout exception
├─ IMMEDIATE ACTION:
│  ├─ Log error с endpoint и operation
│  ├─ Catch boto3.ClientError специфично
│  └─ Отправить error alert в Telegram
├─ RECOVERY:
│  ├─ Если ошибка временная: health_check() вернет false
│  ├─ Следующий job попробует снова через час
│  └─ cleanup_old_backups() вернет (0, 1, 0) - ошибка
└─ FALLBACK: Telegram alerter отключится gracefully если нет credentials
```

### 1.3 Обработка сбоев в цепочке FastAPI → PostgreSQL → Telegram

```
SCHEDULED JOB FAILURE PATTERN:
collect_analytics_job() triggered by APScheduler
    │
    ├─ await db_manager.get_database_stats()
    │  └─ 5 параллельных запросов (asyncio.gather)
    │
    ├─ await s3_manager.get_total_backups_size()
    │  └─ boto3 list_objects_v2
    │
    ├─ await db_manager.insert_analytics_stats()
    │  └─ SQL INSERT
    │
    └─ await telegram_alerter.send_analytics_report()
       └─ httpx async POST

ERROR HANDLING AT EACH LEVEL:
├─ DB Level:
│  ├─ asyncpg Exception → log + raise
│  ├─ Finally block гарантирует release connection
│  └─ Pool сохраняет state для retry
├─ S3 Level:
│  ├─ ClientError → log + set error_count
│  ├─ continue job execute (не критично)
│  └─ report успешно что удалили N файлов, M ошибок
└─ Telegram Level:
   ├─ httpx.TimeoutException → log warning (не критично)
   ├─ Alerter.enabled=False → gracefully skip
   └─ Job completes успешно несмотря на alert fail
```

## Раздел 2: Архитектура Python Backend

### 2.1 Многоуровневая архитектура

```
┌─────────────────────────────────────────────────┐
│ PRESENTATION (Next.js Frontend)                 │
│ ┌──────────┐ ┌───────────────┐ ┌────────────┐ │
│ │Dashboard │ │AnalyticsTable │ │Health Info │ │
│ └────┬─────┘ └───────┬───────┘ └──────┬─────┘ │
└──────┼────────────────┼────────────────┼────────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
┌─────────────────────────────────────────────────┐
│ API LAYER (FastAPI + APScheduler)              │
│ ┌─────────────────────────────────────────────┐│
│ │ GET  /health                                ││
│ │ POST /api/trigger-cleanup                   ││
│ │ POST /api/trigger-analytics                 ││
│ │ GET  / (info endpoint)                      ││
│ │ └─ Plus: APScheduler scheduled jobs         ││
│ │    ├─ collect_analytics_job (hourly)        ││
│ │    └─ cleanup_backups_job (daily)           ││
│ └─────────────────────────────────────────────┘│
└────────────────┬─────────────┬────────┬────────┘
                 │             │        │
      ┌──────────▼─┐  ┌───────▼──┐  ┌──▼──────────┐
      │  Database  │  │ Storage  │  │  Alerting   │
      │  Manager   │  │ Manager  │  │   Service   │
      └────────────┘  └──────────┘  └─────────────┘
             │              │              │
             ▼              ▼              ▼
    ┌──────────────────────────────────────────────┐
    │ INFRASTRUCTURE LAYER                         │
    ├─ PostgreSQL (asyncpg pool: 5-20 conns)      │
    ├─ MinIO/S3 (boto3 sync client)               │
    └─ Telegram (httpx async client)              │
    └──────────────────────────────────────────────┘
```

### 2.2 Компоненты Python Backend

```
main.py
├─ FastAPI application initialization
├─ Environment variable loading (17 vars)
├─ Lifespan context manager
│  ├─ startup: initialize_managers(), initialize_scheduler()
│  └─ shutdown: scheduler.shutdown(), db_manager.close()
├─ REST endpoints
│  ├─ GET  /health → HealthResponse
│  ├─ POST /api/trigger-cleanup → CleanupResponse
│  ├─ POST /api/trigger-analytics → AnalyticsResponse
│  └─ GET  / → {"status": "running", ...}
├─ Global exception handler
└─ Scheduled jobs configuration

db_manager.py
├─ DatabaseManager class
├─ asyncpg pool management
│  ├─ min_size=5 (always ready)
│  ├─ max_size=20 (scalable)
│  └─ auto-reconnect on failure
└─ Methods:
   ├─ async connect() → Pool
   ├─ async get_database_stats() → dict (5 parallel queries)
   ├─ async insert_analytics_stats(...) → record_id
   ├─ async log_backup_deletion(...) → None
   ├─ async get_total_saved_space() → int
   └─ async health_check() → bool

s3_manager.py
├─ S3Manager class
├─ boto3 S3 client (MinIO compatible)
├─ Dynamic endpoint URL (http/https based on use_ssl)
└─ Methods:
   ├─ async get_bucket_contents() → List[Object]
   ├─ async get_old_backups(days) → List[Object]
   ├─ async delete_file(key) → bool
   ├─ async cleanup_old_backups(days) → (count, errors, size)
   ├─ async get_total_backups_size() → (size, count)
   └─ async health_check() → bool

telegram_alerts.py
├─ TelegramAlerter class
├─ AlertType enum (SUCCESS, ERROR, WARNING, INFO)
├─ Graceful enable/disable (checks credentials)
└─ Methods:
   ├─ async send_message(text) → None
   ├─ async send_cleanup_report(...) → None
   ├─ async send_analytics_report(...) → None
   └─ async send_error_alert(...) → None
```

### 2.3 Async Execution Flow

```
┌─────────────────────────────────────────────┐
│ HTTP: POST /api/trigger-analytics          │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ async trigger_analytics()                   │
│ ├─ db_stats = await db_manager.get_database_stats()
│ │  └─ asyncio.gather(5 queries in parallel)
│ │     └─ Selects: tables, size, indexes, active, idle
│ │
│ ├─ s3_stats = await s3_manager.get_total_backups_size()
│ │  └─ boto3 list_objects_v2
│ │
│ ├─ record_id = await db_manager.insert_analytics_stats(...)
│ │  └─ INSERT analytics_stats (...)
│ │
│ ├─ await telegram_alerter.send_analytics_report(...)
│ │  └─ httpx.AsyncClient().post(telegram.org)
│ │
│ └─ return AnalyticsResponse(success=True, record_id=id)
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ Return JSON to client                       │
└─────────────────────────────────────────────┘
```

## Раздел 3: Scheduled Jobs (APScheduler)

### 3.1 Job Configuration

```python
# collect_analytics_job
├─ Trigger: CronTrigger(minute=0)  # Каждый час в 0 минут
├─ Execution time: ~2-5 seconds
└─ Operations:
   1. get_database_stats() (parallel queries)
   2. get_total_backups_size() (S3 list)
   3. insert_analytics_stats() (save to DB)
   4. send_analytics_report() (Telegram notification)

# cleanup_backups_job
├─ Trigger: CronTrigger(hour=2, minute=0)  # Ежедневно 02:00 UTC
├─ Execution time: ~5-30 seconds (depends on backups count)
└─ Operations:
   1. cleanup_old_backups(days=7) (S3 delete)
   2. log_backup_deletion() (DB logging)
   3. send_cleanup_report() (Telegram notification)
```

### 3.2 Error Resilience in Jobs

```
If collect_analytics_job() FAILS:
├─ Database error → logged + exception raised → job fails
├─ S3 error → logged + continue (optional data)
├─ Telegram error → logged warning + continue
└─ Overall job result: success/failure sent to logs

If cleanup_backups_job() FAILS:
├─ S3 error → break cleanup, log all errors
├─ Database error → cleanup completed, logging failed
├─ Telegram error → cleanup+log success, alert failed
└─ Job tries again tomorrow (scheduler persists)
```

## Раздел 4: Health Checks

### 4.1 Health Check Hierarchy

```
GET /health Response:
{
  "status": "healthy" | "degraded" | "unhealthy",
  "database": true | false,
  "s3": true | false,
  "scheduler": true | false,
  "next_jobs": [
    {"name": "collect_analytics_job", "next_run": "2025-02-27T14:00:00Z"},
    {"name": "cleanup_backups_job", "next_run": "2025-02-28T02:00:00Z"}
  ],
  "timestamp": "2025-02-27T13:42:15.123456Z"
}

Status Interpretation:
├─ healthy:   All 3 services: true
├─ degraded:  At least 1 service: false (but not DB)
├─ unhealthy: Database: false
```

### 4.2 Container Health Check

```yaml
# docker-compose.yml for python_backend
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

## Раздел 5: Data Flow Scenarios

### 5.1 Сценарий: Полная потеря соединения с PostgreSQL

```
collect_analytics_job() TRIGGERED
    │
    ├─ db_manager.get_database_stats()
    │  └─ asyncpg.PostgresError: connection refused
    │     └─ Logged + Re-raised
    │
    └─ Job FAILS with exception
       ├─ Telegram alert sent: "Analytics collection failed"
       ├─ Status logged with error context
       └─ Scheduler schedules retry for next hour

RECOVERY:
├─ DBA fixes PostgreSQL
└─ Next hour: job runs successfully, data collected
```

### 5.2 Сценарий: S3 недоступен, но БД работает

```
cleanup_backups_job() TRIGGERED
    │
    ├─ s3_manager.cleanup_old_backups()
    │  └─ boto3.ClientError: bucket not responding
    │     ├─ Error logged
    │     ├─ error_count incremented
    │     └─ Job continues
    │
    ├─ db_manager.log_backup_deletion(0, 1, 0)
    │  └─ INSERT: "cleanup attempted, 0 deleted, 1 error"
    │
    ├─ telegram_alerter.send_cleanup_report(...)
    │  ├─ Report includes: ✗ 0 deleted, 1 error
    │  └─ Alert type: WARNING
    │
    └─ Job SUCCEEDS (partial completion)
       ├─ Status logged: "Cleanup with errors"
       ├─ Admin alerted via Telegram
       └─ Next day: job retries
```

### 5.3 Сценарий: ВСЕ сервисы работают идеально

```
00:00 - collect_analytics_job QUEUED
    │
02:00 - cleanup_backups_job QUEUED (same event loop)
    │
    ├─ cleanup completes
    ├─ Telegram alert sent
    └─ Logs recorded

01:00 - collect_analytics_job TRIGGERED
    │
    ├─ DB stats: 45 tables, 128GB, 15 connections
    ├─ S3 stats: 52 files, 450GB
    ├─ Record inserted: id=1523
    ├─ Telegram: ✓ Analytics collected
    └─ Logs: INFO "Analytics collection successful"

02:00 - cleanup_backups_job TRIGGERED
    │
    ├─ S3: delete 3 old backups (75GB freed)
    ├─ DB: log deletions with sizes
    ├─ Telegram: ✓ Cleanup completed, 75GB freed
    └─ Logs: INFO "Cleanup successful, deleted 3 files"
```

## Раздел 6: Безопасность

### 6.1 Переменные окружения (чувствительные данные)

```
# НИКОГДА в код или git
├─ DB_PASSWORD
├─ MINIO_SECRET_KEY
├─ MINIO_ACCESS_KEY
├─ TELEGRAM_BOT_TOKEN
└─ TELEGRAM_CHAT_ID

# Хранение
├─ .env.local (локально, не в git)
├─ docker-compose.yml references .env (не коммитится)
└─ Kubernetes secrets (для production)
```

### 6.2 Input Validation

```python
# Pydantic models для validation всех responses
class CleanupResponse(BaseModel):
    success: bool
    deleted_files: int
    total_size_freed: int
    errors: int
    message: str

# FastAPI автоматически валидирует
# - Обрезает extra fields
# - Валидирует типы
# - Требует все required fields
```

### 6.3 Database Security

```sql
-- SQL файлы не содержат чувствительные данные
-- Все параметры передаются как $1, $2 (защита от SQL injection)
-- Пример безопасного запроса:
INSERT INTO analytics_stats 
  (db_tables_count, backups_size, ...)
VALUES 
  ($1, $2, ...);
```

## Раздел 7: Логирование

### 7.1 Вывод логов

```
LOG_LEVEL=INFO

db_manager.py:
├─ "Database pool created: min_size=5, max_size=20"
├─ "Database query executed: 245ms"
├─ "ERROR: PostgresError - connection refused"
└─ Finally block: "Connection released to pool"

s3_manager.py:
├─ "Connected to MinIO: minio:9000 (http)"
├─ "Found 52 backup files totaling 450.2 GB"
├─ "Deleting old backup: 2025-02-20-backup.sql.gz"
└─ "ERROR: AWS ClientError - 403 Forbidden"

telegram_alerts.py:
├─ "Telegram alerting enabled"
├─ "Message sent to chat 987654321"
├─ "WARNING: Telegram timeout, message not delivered"
└─ "Telegram alerting disabled (no credentials)"

main.py:
├─ "Application startup: initializing managers"
├─ "Scheduler started with 2 jobs"
├─ "Health check: all systems OK"
└─ "ERROR: Unhandled exception in request handler"
```

### 7.2 Структурированное логирование

```python
# Все логи содержат context
logger.error("Analytics insert failed", extra={
    "operation": "insert_analytics_stats",
    "record_id": 123,
    "db_error": "duplicate key",
    "timestamp": datetime.now().isoformat()
})
```

## Раздел 8: Мониторинг и Метрики

### 8.1 Собираемые метрики (hourly)

```
analytics_stats таблица:
├─ db_tables_count (количество таблиц)
├─ db_size (size in bytes)
├─ indexes_size (size in bytes)
├─ active_connections (count)
├─ idle_connections (count)
├─ backups_count (count)
├─ backups_size (size in bytes)
└─ timestamp (UTC)

backup_deletion_logs таблица:
├─ backup_key (S3 key)
├─ deleted_size (size in bytes)
├─ reason (retention policy / manual)
└─ deleted_at (timestamp)
```

### 8.2 Monitoring через health checks

```bash
# Docker контейнер мониторит здоровье
docker ps
# STATUS: Up 2 minutes (healthy)

# Manual health check
curl http://localhost:8000/health

# Kubernetes health probes
livenessProbe: /health (restart if unhealthy)
readinessProbe: /health (remove from service if degraded)
```

## Раздел 9: Performance Optimization

### 9.1 Connection Pool Benefits

```
asyncpg Pool: min=5, max=20
├─ Minute 0: job_1 takes 5 connections
├─ Minute 1: job_2 queues for connection
├─ Minute 2+ more requests share pool
├─ Auto-grow to 20 if needed
└─ Auto-shrink back to 5 when idle

Without pooling:
├─ Each request creates new connection (slow)
├─ Connection overhead: 100-500ms
└─ Resource exhaustion risk

With pooling:
├─ Reuse existing connections
├─ Connection overhead: 1-5ms
└─ Guaranteed capacity
```

### 9.2 Parallel Query Execution

```python
# Without parallelism (sequential)
Duration: 100ms + 150ms + 80ms = 330ms total

# With parallelism (concurrent)
async with db_manager.pool.acquire() as conn:
tasks = [
    conn.fetch("SELECT COUNT(*) FROM all_tables"),
    conn.fetch("SELECT pg_database_size(...)"),
    conn.fetch("SELECT sum(bytes) FROM pg_indexes"),
    conn.fetch("SELECT count(*) FROM pg_stat_activity WHERE state='active'"),
    conn.fetch("SELECT count(*) FROM pg_stat_activity WHERE state='idle'")
]
results = await asyncio.gather(*tasks)
# Duration: 150ms (slowest query) instead of 410ms
```

### 9.3 Async I/O Benefits

```
httpx.AsyncClient for Telegram
├─ Without async: blocks on network I/O (10s timeout × N requests)
├─ With async: sends multiple POST requests concurrently
└─ Result: 10 requests in 10s (not 100s)

boto3 for S3
├─ Without async: list_objects_v2 blocks (could be 5-10s for large bucket)
├─ With async: runs concurrently with DB queries
└─ Result: total job time: max(db_time, s3_time) not sum
```

## Раздел 10: Развитие и Масштабирование

### 10.1 Текущая архитектура

```
✓ Monolithic backend (простая)
✓ Single scheduled process
✓ All managers in one process
✓ Подходит для: ~1000 backups, ~100GB data
```

### 10.2 Масштабирование Phase 2

```
Опция 1: Async task queue
├─ RabbitMQ or Redis queue
├─ Multiple worker processes
├─ Better error handling and retries
└─ Подходит для: миллионы операций с бэкапами

Опция 2: Distributed system
├─ Separate service for analytics
├─ Separate service for cleanup
├─ Leader election for scheduling
└─ Подходит для: multi-region deployment

Опция 3: Cloud-native
├─ AWS Lambda for scheduled jobs
├─ DynamoDB for state
├─ SNS for notifications
└─ Подходит для: serverless cost optimization
```

### 10.3 Performance Improvements (future)

```
Redis Cache Layer
├─ Cache recent analytics (TTL: 5 min)
├─ Reduce database load
└─ Faster dashboard loads

TimescaleDB
├─ Optimized for time-series data
├─ 100x compression
├─ Continuous aggregates
└─ Подходит для: years of analytics data

Prometheus Metrics
├─ Scrape /metrics endpoint
├─ Grafana dashboards
├─ AlertManager integration
└─ Подходит для: production monitoring
```

---

**Архитектура создана**: 2025-02-27  
**Версия**: 2.0.0 (Python Backend)  
**Миграция с n8n**: [PYTHON_BACKEND_MIGRATION.md](PYTHON_BACKEND_MIGRATION.md)
