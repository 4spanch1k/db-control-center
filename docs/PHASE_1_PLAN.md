# Phase 1 Plan (Foundation)

## Completed in this pass

- Unified command entrypoint via `Makefile`.
- Added migration framework (`python-backend/alembic`).
- Added baseline migration for core schema + analytics SQL functions.
- Added development docs (`docs/DEVELOPMENT.md`).
- Added structure doc (`docs/PROJECT_STRUCTURE.md`).

## Next tasks

1. Add CI pipeline: lint + backend tests + migration check.
2. Replace runtime table creation in backend with strict migration-first startup.
3. Add seed command for first admin user.
4. Introduce lightweight integration tests for backup/restore API endpoints.
