SHELL := /bin/bash

COMPOSE ?= docker compose
PYTHON ?= python3
BACKEND_DIR := python-backend
FRONTEND_DIR := frontend
MIGRATION_MSG ?= new_migration

.PHONY: help bootstrap dev down logs lint test frontend-install frontend-dev backend-install backend-dev migrate-up migrate-down migrate-current migrate-create

help:
	@echo "Available commands:"
	@echo "  make bootstrap        # Install local dependencies"
	@echo "  make dev              # Start all services via Docker Compose"
	@echo "  make down             # Stop Docker Compose services"
	@echo "  make logs             # Tail Docker Compose logs"
	@echo "  make lint             # Run frontend lint + backend syntax check"
	@echo "  make frontend-dev     # Run Next.js dev server"
	@echo "  make backend-dev      # Run FastAPI dev server"
	@echo "  make migrate-up       # Apply Alembic migrations"
	@echo "  make migrate-down     # Roll back one migration"
	@echo "  make migrate-current  # Show current migration"
	@echo "  make migrate-create MIGRATION_MSG=...  # Create migration"

bootstrap: backend-install frontend-install

backend-install:
	cd $(BACKEND_DIR) && $(PYTHON) -m pip install -r requirements.txt

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

test: lint
	@echo "No backend test suite configured yet (lint/syntax checks passed)."

frontend-dev:
	cd $(FRONTEND_DIR) && npm run dev

backend-dev:
	cd $(BACKEND_DIR) && uvicorn main:app --reload --host 0.0.0.0 --port 8000

migrate-up:
	cd $(BACKEND_DIR) && alembic upgrade head

migrate-down:
	cd $(BACKEND_DIR) && alembic downgrade -1

migrate-current:
	cd $(BACKEND_DIR) && alembic current

migrate-create:
	cd $(BACKEND_DIR) && alembic revision -m "$(MIGRATION_MSG)"
