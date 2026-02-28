# Phase 1 Plan (Foundation)

## Completed in this pass

- Unified command entrypoint via `Makefile`.
- Added migration framework (`python-backend/alembic`).
- Added baseline migration for core schema + analytics SQL functions.
- Added development docs (`docs/DEVELOPMENT.md`).
- Added structure doc (`docs/PROJECT_STRUCTURE.md`).
- Added CI pipeline (`.github/workflows/ci.yml`).
- Replaced runtime table creation with migration-first startup in backend.
- Added seed command/script for first admin user.
- Added integration tests for backup/restore/cleanup critical flows.

## Next tasks (Phase 2)

1. Add stricter auth hardening (refresh tokens + secure cookie policy).
2. Split backend into modules (`api`, `services`, `repositories`) with smaller files.
3. Add basic observability endpoints/metrics (latency, scheduler job outcomes).
4. Add test database fixture with dockerized Postgres for migration e2e tests.
