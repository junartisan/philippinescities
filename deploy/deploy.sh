#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/philippines}"
PYTHON="${PYTHON:-python3}"

cd "$APP_DIR"

if [ ! -x .venv/bin/python ]; then
  "$PYTHON" -m venv .venv
fi

.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

mkdir -p uploads

cd frontend
npm ci
npm run build
cd ..

sudo systemctl restart philippines-api.service philippines-web.service
sudo nginx -t
sudo systemctl reload nginx
