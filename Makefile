# SafeRide — run backend (FastAPI), frontend (Next.js), or both.
# Invoke from the repository root: `make install`, `make backend`, `make frontend`, `make dev`.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Match backend/.env if needed: make backend BACKEND_PORT=9000
BACKEND_HOST ?= 127.0.0.1
BACKEND_PORT ?= 8000

.PHONY: help install backend frontend dev

help:
	@echo "SafeRide"
	@echo "  make install   - backend (uv sync) + frontend (npm install)"
	@echo "  make backend   - uvicorn app.main:app (uv run, reload + debug logs)"
	@echo "  make frontend  - Next.js dev server (npm run dev)"
	@echo "  make dev       - backend + frontend (Ctrl+C stops both)"

install:
	cd backend && uv sync
	npm install

backend:
	cd backend && uv run uvicorn app.main:app \
		--host $(BACKEND_HOST) \
		--port $(BACKEND_PORT) \
		--reload \
		--access-log \
		--log-level debug \
		--use-colors

frontend:
	npm run dev

# Run API and Next together; trap tears down background jobs on INT/TERM/EXIT.
dev:
	@trap 'kill $$(jobs -p) 2>/dev/null || true' INT TERM EXIT; \
	(cd backend && uv run uvicorn app.main:app \
		--host $(BACKEND_HOST) \
		--port $(BACKEND_PORT) \
		--reload \
		--access-log \
		--log-level debug \
		--use-colors) & \
	npm run dev & \
	wait
