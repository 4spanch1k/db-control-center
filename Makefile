SHELL := /bin/bash

COMPOSE ?= docker compose
PYTHON ?= python3
BACKEND_DIR := python-backend
FRONTEND_DIR := frontend
MIGRATION_MSG ?= new_migration
VENV_DIR := .venv
VENV_BIN := $(VENV_DIR)/bin
BACKEND_PY := $(VENV_BIN)/python
ALEMBIC := $(VENV_BIN)/alembic
UVICORN := $(VENV_BIN)/uvicorn

.PHONY: help bootstrap dev down logs lint test verify frontend-build frontend-install frontend-dev backend-install backend-dev migrate-up migrate-down migrate-current migrate-create seed-admin backend-tests

help:
	@echo "Available commands:"
	@echo "  make bootstrap        # Install local dependencies"
	@echo "  make dev              # Start all services via Docker Compose"
	@echo "  make down             # Stop Docker Compose services"
	@echo "  make logs             # Tail Docker Compose logs"
	@echo "  make lint             # Run frontend lint + backend syntax check"
	@echo "  make frontend-build   # Build Next.js frontend (webpack)"
	@echo "  make verify           # lint + backend tests + frontend build"
	@echo "  make frontend-dev     # Run Next.js dev server"
	@echo "  make backend-dev      # Run FastAPI dev server"
	@echo "  make migrate-up       # Apply Alembic migrations"
	@echo "  make migrate-down     # Roll back one migration"
	@echo "  make migrate-current  # Show current migration"
	@echo "  make migrate-create MIGRATION_MSG=...  # Create migration"
	@echo "  make seed-admin ADMIN_PASSWORD=... [ADMIN_EMAIL=...]"
	@echo "  make backend-tests    # Run backend integration tests"

bootstrap: backend-install frontend-install

backend-install:
	$(PYTHON) -m venv $(VENV_DIR)
	$(BACKEND_PY) -m pip install --upgrade pip
	$(BACKEND_PY) -m pip install -r $(BACKEND_DIR)/requirements.txt

frontend-install:
	cd $(FRONTEND_DIR) && npm install

dev:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=200

lint:
	cd $(FRONTEND_DIR) && npm run lint
	$(PYTHON) -m compileall $(BACKEND_DIR)

verify: lint backend-tests frontend-build

test: verify

backend-tests:
	$(PYTHON) -m unittest discover -s $(BACKEND_DIR)/tests -p "test_*.py" -v

frontend-build:
	cd $(FRONTEND_DIR) && npm run build

frontend-dev:
	cd $(FRONTEND_DIR) && npm run dev

backend-dev:
	cd $(BACKEND_DIR) && $(abspath $(UVICORN)) main:app --reload --host 0.0.0.0 --port 8000

migrate-up:
	cd $(BACKEND_DIR) && $(abspath $(ALEMBIC)) upgrade head

migrate-down:
	cd $(BACKEND_DIR) && $(abspath $(ALEMBIC)) downgrade -1

migrate-current:
	cd $(BACKEND_DIR) && $(abspath $(ALEMBIC)) current

migrate-create:
	cd $(BACKEND_DIR) && $(abspath $(ALEMBIC)) revision -m "$(MIGRATION_MSG)"

seed-admin:
	@if [ -z "$$ADMIN_PASSWORD" ]; then echo "Set ADMIN_PASSWORD env var"; exit 1; fi
	cd $(BACKEND_DIR) && \
	ADMIN_EMAIL=$${ADMIN_EMAIL:-admin@example.com} \
	ADMIN_PASSWORD=$$ADMIN_PASSWORD \
	$(abspath $(BACKEND_PY)) scripts/seed_admin.py
