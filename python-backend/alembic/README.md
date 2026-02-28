# Alembic Migrations

This folder contains schema migrations for the backend database.

Run from repository root:

```bash
make migrate-up
make migrate-current
make migrate-create MIGRATION_MSG="my_change"
```

Environment variables used:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
