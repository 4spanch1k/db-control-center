# Demo Runbook

Руководство для воспроизводимого демо DB Control Center с нуля.

## 1) Требования

- Docker Desktop (или Docker Engine) + `docker compose`
- Node.js 20+
- Python 3.11+

## 2) Включить Docker daemon

Если видите `Cannot connect to the Docker daemon`, сначала запустите daemon:

- macOS: откройте Docker Desktop и дождитесь статуса `Engine running`
- Linux: `sudo systemctl start docker`
- Windows: запустите Docker Desktop и дождитесь запуска engine

Проверка:

```bash
docker info >/dev/null && echo "Docker daemon is running"
```

Ожидаемый результат: печатается `Docker daemon is running`.

## 3) Минимальные переменные окружения

Создайте локальный `.env`:

```bash
cp .env.example .env
```

Минимально нужны (дефолтов из `.env.example` достаточно для локального демо):

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `MINIO_ENDPOINT`, `MINIO_USER`, `MINIO_PASSWORD`, `MINIO_BUCKET`
- `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`
- `PYTHON_BACKEND_URL`
- `AUTO_APPLY_MIGRATIONS=true` (чтобы backend сам применил Alembic на старте)

## 4) Запуск демо одной командой

```bash
make demo
```

Команда-эквивалент:

```bash
docker compose up -d --build
```

Проверка:

```bash
docker compose ps
```

Ожидаемый результат: подняты как минимум `metadata-postgres`, `target-postgres`, `minio`, `python_backend` (и обычно `app`).

## 5) Alembic migrations

По умолчанию backend применяет миграции автоматически при `AUTO_APPLY_MIGRATIONS=true`.

Если авто-миграции отключены, примените вручную:

```bash
make bootstrap
make migrate-up
```

Проверка:

```bash
cd python-backend && ../.venv/bin/alembic current
```

Ожидаемый результат: показан текущий `head` revision.

## 6) Фронтенд отдельно одной командой

Вариант через Make:

```bash
make demo-frontend
```

Или напрямую (как в чек-листе локальной проверки):

```bash
cd frontend && npm run dev
```

Ожидаемый результат: Next.js dev server запущен на `http://localhost:3000`.

## 7) Полезные проверки после запуска

```bash
curl http://localhost:8000/health
curl -I http://localhost:3000
```

Ожидаемый результат: backend отвечает `200`, фронтенд доступен.

## 8) Остановить демо

```bash
make down
```
