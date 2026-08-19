#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="$HOME/.local/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PYTHON_BIN="$BACKEND_DIR/venv/bin/python"

if [[ ! -x "$PYTHON_BIN" ]]; then
    printf '%s\n' 'Falta el entorno Python. Ejecuta ./instalar_dependencias.sh primero.' >&2
    exit 1
fi

if [[ ! -x "$FRONTEND_DIR/node_modules/.bin/vite" ]]; then
    printf '%s\n' 'Faltan las dependencias del frontend. Ejecuta ./instalar_dependencias.sh primero.' >&2
    exit 1
fi

(
    cd "$BACKEND_DIR"
    "$PYTHON_BIN" -m alembic upgrade head
)

backend_pid=""
frontend_pid=""

cleanup() {
    trap - EXIT INT TERM
    [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true
    [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

printf '%s\n' 'Iniciando backend en http://localhost:8001'
(
    cd "$BACKEND_DIR"
    exec "$PYTHON_BIN" -m uvicorn main:app --host 0.0.0.0 --port 8001
) &
backend_pid=$!

printf '%s\n' 'Iniciando frontend en http://localhost:5174'
(
    cd "$FRONTEND_DIR"
    exec npm run dev -- --host 0.0.0.0 --port 5174 --strictPort
) &
frontend_pid=$!

printf '%s\n' 'Aplicación iniciada. Pulsa Ctrl+C para detenerla.'
wait -n "$backend_pid" "$frontend_pid"
