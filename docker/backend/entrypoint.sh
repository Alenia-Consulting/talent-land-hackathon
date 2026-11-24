#!/bin/sh
set -e

if [ -f /vault/secrets/.env ]; then
    set -a
    . /vault/secrets/.env
    set +a
fi

exec uvicorn main:app --host 0.0.0.0 --port 8000
