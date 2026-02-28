# Project Structure (Minimal and Clear)

## Current layout

- `python-backend/` - FastAPI backend service.
- `frontend/` - Next.js frontend with CSS Modules (no Tailwind).
- `sql/` - legacy SQL scripts for analytics and reporting functions.
- `docker-compose.yml` - local/dev orchestration.
- `Makefile` - single command entrypoint for common workflows.

## Target logical layout

- `backend/` (logical) -> currently implemented as `python-backend/`.
- `frontend/` - Next.js frontend with CSS Modules (no Tailwind).
- `infra/` -> infrastructure configs and environment templates.
- `docs/` -> architecture, runbooks and conventions.
- `migrations/` -> database schema evolution via Alembic (inside `python-backend/alembic/`).

## Current repository decision

- `frontend` is now part of the main repository; no submodule management required.
- Project paths are explicit and flat for easier navigation.
- Workflow is standardized through `make` commands.

## Style rules accepted for this codebase

- Keep UI styling in plain CSS / CSS Modules.
- No Tailwind.
- Prefer short files and explicit names over abstractions.
- One obvious way to run each routine (`make ...`).
