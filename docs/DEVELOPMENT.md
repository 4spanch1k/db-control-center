# Development Workflow

## One-time setup

```bash
make bootstrap
```

`make bootstrap` creates a local Python virtual environment in `.venv/`.

## Daily commands

```bash
make dev            # docker compose up -d --build
make logs           # tail logs
make down           # stop containers
make lint           # eslint + python syntax compile check
make test           # includes backend integration tests
```

## Backend migrations (Alembic)

```bash
make migrate-up
make migrate-current
make migrate-create MIGRATION_MSG="add_some_table"
make migrate-down
make seed-admin ADMIN_PASSWORD="change_me" ADMIN_EMAIL="admin@example.com"
```

## Frontend style policy

- Use CSS Modules and plain CSS only.
- Keep component styles close to component files.
- No Tailwind classes in JSX.

## CI

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Runs backend syntax checks, backend integration tests, migration checks and frontend lint on push/PR.
