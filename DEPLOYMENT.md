# 🚀 Быстрое развертывание (после миграции с n8n)

## ⚡ За 3 команды к работающей системе

### 1️⃣ Конфигурация

```bash
# Скопировать шаблон конфигурации
cp .env.example .env.local

# ВАЖНО: Отредактировать .env.local и заполнить:
# - DB_PASSWORD (если отличается от default)
# - TELEGRAM_BOT_TOKEN (опционально)
# - TELEGRAM_CHAT_ID (опционально)
nano .env.local
```

### 2️⃣ Развертывание контейнеров

```bash
# Пересоздать всю инфраструктуру (удалить старые n8n данные)
docker-compose down -v
docker-compose up -d

# Дождаться запуска (обычно 30-60 секунд)
docker-compose logs -f python_backend
# Выход: Ctrl+C когда увидите "Application started successfully"
```

### 3️⃣ Проверка здоровья

```bash
# Проверить Python backend
curl http://localhost:8000/health

# Проверить Next.js приложение
curl http://localhost:3000

# Открыть в браузере
open http://localhost:3000/analytics
```

## 🧪 Ручное тестирование

### Запустить очистку бэкапов

```bash
curl -X POST http://localhost:8000/api/trigger-cleanup

# Ответ:
# {
#   "success": true,
#   "deleted_files": 2,
#   "total_size_freed": 2147483648,
#   "errors": 0,
#   "message": "Cleanup completed..."
# }
```

### Собрать аналитику

```bash
curl -X POST http://localhost:8000/api/trigger-analytics

# Ответ:
# {
#   "success": true,
#   "record_id": 42,
#   "message": "Analytics record created successfully"
# }
```

### Посмотреть логи

```bash
# Python backend
docker-compose logs python_backend -f

# Next.js app
docker-compose logs app -f

# PostgreSQL
docker-compose logs metadata-postgres -f

# MinIO
docker-compose logs minio -f
```

## 🔧 Переменные окружения

| Переменная | Default | Описание |
|-----------|---------|---------|
| `DB_HOST` | metadata-postgres | Хост PostgreSQL |
| `DB_USER` | postgres | Пользователь БД |
| `DB_PASSWORD` | postgres | Пароль БД |
| `MINIO_ENDPOINT` | minio:9000 | Endpoint S3 |
| `BACKUP_RETENTION_DAYS` | 7 | Дней хранения бэкапов |
| `TELEGRAM_BOT_TOKEN` | (пусто) | Токен Telegram бота |
| `TELEGRAM_CHAT_ID` | (пусто) | ID чата Telegram |

## 📅 Автоматический график

- **Каждый час (в 0 минут)**: Сбор аналитики БД и размера бэкапов
- **Ежедневно в 02:00 UTC**: Удаление бэкапов старше 7 дней

Вы можете изменить график в файле [python-backend/main.py](../python-backend/main.py)

## 🔄 Обновление кода

```bash
# Если изменили код Python backend
docker-compose build python_backend
docker-compose up -d python_backend

# Если изменили код Next.js
docker-compose build app
docker-compose up -d app
```

## 🛑 Остановка и удаление

```bash
# Остановить все контейнеры (сохраняя данные)
docker-compose stop

# Полное удаление (включая volumes!)
docker-compose down -v
```

## 🆘 Возможные проблемы

### "Connection refused" на localhost:8000
```bash
# Проверить, запущен ли контейнер
docker ps | grep python_backend

# Если не запущен, посмотреть ошибку
docker-compose logs python_backend --tail=50
```

### "Cannot list bucket contents"
```bash
# Убедитесь, что MinIO запущен
docker ps | grep minio

# Создайте бакет если нужно
docker exec db-control-center-minio mc mb minio/backups
```

### "Database is not available"
```bash
# Убедитесь, что PostgreSQL инициализирована
docker-compose exec metadata-postgres pg_isready

# Если нужно выполнить SQL скрипты
docker-compose exec metadata-postgres psql -U postgres -d control_center \
  -c "SELECT * FROM analytics_stats LIMIT 1;"
```

## 📚 Полная документация

- [PYTHON_BACKEND_MIGRATION.md](PYTHON_BACKEND_MIGRATION.md) - Детали миграции с n8n
- [ARCHITECTURE.md](ARCHITECTURE.md) - Архитектурные решения
- [ANALYTICS_README.md](ANALYTICS_README.md) - Документация аналитики
- [README.md](README.md) - Главный README

---

**Система готова к использованию!** ✅
