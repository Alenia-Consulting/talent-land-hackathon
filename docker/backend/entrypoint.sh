#!/bin/sh
set -e

if [ -f /vault/secrets/.env ]; then
    set -a
    . /vault/secrets/.env
    set +a
fi

# Apply pending database migrations (no-op when up to date; concurrent Pods wait on a lock).
alembic upgrade head

exec uvicorn main:app --host 0.0.0.0 --port 8000
