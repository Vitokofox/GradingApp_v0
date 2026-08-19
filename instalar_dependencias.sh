#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="$HOME/.local/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"

fail() {
    printf '\n[ERROR] %s\n' "$1" >&2
    exit 1
}

command -v python3 >/dev/null 2>&1 || fail "Python 3 no está instalado."
command -v node >/dev/null 2>&1 || fail "Node.js no está instalado."
command -v npm >/dev/null 2>&1 || fail "npm no está instalado."

python3 - <<'PY'
import sys
if sys.version_info < (3, 10):
    raise SystemExit("Se requiere Python 3.10 o superior.")
PY

node - <<'JS'
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
    console.error('Se requiere Node.js 22 o superior.');
    process.exit(1);
}
JS

printf '%s\n' '==> Preparando entorno Python'
if [[ ! -x "$VENV_DIR/bin/python" ]]; then
    python3 -m venv "$VENV_DIR"
fi
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"

printf '%s\n' '==> Instalando dependencias del frontend'
(
    cd "$FRONTEND_DIR"
    npm ci
)

if [[ ! -f "$FRONTEND_DIR/.env" ]]; then
    cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
fi

printf '\n%s\n' 'Dependencias instaladas correctamente.'
