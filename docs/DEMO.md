# Demo Runbook

This guide brings DB Control Center to a reproducible local demo state from zero.

## 1) Prerequisites

- Docker + Docker Compose plugin
- Node.js 20+
- Python 3.11+

## 2) Start Docker daemon

If you see `Cannot connect to the Docker daemon`, start Docker first:

- macOS: open Docker Desktop and wait until it shows `Engine running`.
- Linux: `sudo systemctl start docker`
- Windows: start Docker Desktop and wait for the engine.

Quick check:

```bash
docker info >/dev/null && echo "Docker is running"
```

## 3) Minimal environment variables

Create local env file from template:

```bash
cp .env.example .env
```

Minimal required values (defaults in `.env.example` are enough for local demo):

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `MINIO_ENDPOINT`, `MINIO_USER`, `MINIO_PASSWORD`, `MINIO_BUCKET`
- `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`
- `PYTHON_BACKEND_URL`

## 4) One-command demo startup (all services)

```bash
make demo
```

Equivalent raw command:

```bash
docker compose up -d --build
```

Services:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- MinIO Console: http://localhost:9001

## 5) Alembic migrations

In this project migrations are auto-applied by backend if:

- `AUTO_APPLY_MIGRATIONS=true`

Manual migration command (if auto-apply is disabled):

```bash
make bootstrap
make migrate-up
```

## 6) Frontend-only run (single command)

```bash
make demo-frontend
```

This starts Next.js dev server locally.

## 7) Stop demo

```bash
make down
```
