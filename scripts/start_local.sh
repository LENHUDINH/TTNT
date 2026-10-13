#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p runtime
# Database is managed by XAMPP. Never launch or stop its shared MariaDB here.
if ! /Applications/XAMPP/xamppfiles/bin/mysqladmin --no-defaults --host=127.0.0.1 --port=3306 --user=root ping >/dev/null 2>&1; then
  printf '%s\n' 'Start MySQL in XAMPP before launching FinSight.' >&2
  exit 1
fi
sh scripts/run_ai.sh > runtime/ai.log 2>&1 &
printf '%s\n' "$!" > runtime/ai.pid
ai-service/.venv/bin/python -m uvicorn scripts.mail_sink:app --host 127.0.0.1 --port 8025 > runtime/mail.log 2>&1 &
printf '%s\n' "$!" > runtime/mail.pid
sh scripts/run_backend.sh > runtime/backend.log 2>&1 &
(cd frontend && npm run dev) > runtime/frontend.log 2>&1 &
printf '%s\n' "$!" > runtime/frontend.pid
printf '%s\n' 'FinSight local processes started. Frontend: http://127.0.0.1:5173; logs: runtime/'
