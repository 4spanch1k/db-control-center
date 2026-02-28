# Development Workflow

## One-time setup

```bash
make bootstrap
```

## Daily commands

```bash
make dev            # docker compose up -d --build
make logs           # tail logs
make down           # stop containers
make lint           # eslint + python syntax compile check
```

## Backend migrations (Alembic)

```bash
make migrate-up
make migrate-current
make migrate-create MIGRATION_MSG="add_some_table"
make migrate-down
```

## Frontend style policy

- Use CSS Modules and plain CSS only.
- Keep component styles close to component files.
- No Tailwind classes in JSX.
