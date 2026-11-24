#!/bin/sh
set -e

API_UPSTREAM=${API_UPSTREAM:-talent-land-hackathon-api:8000}
sed -i "s/__API_UPSTREAM__/${API_UPSTREAM}/g" /etc/nginx/conf.d/default.conf

# Browser runtime configuration (read by client/lib/config.ts): every NEXT_PUBLIC_* variable of the
# container goes to /env.js. These values are public: never put secrets in NEXT_PUBLIC_* variables.
{
    echo "window.__ENV__ = {"
    env | grep '^NEXT_PUBLIC_' | sort | while IFS='=' read -r key value; do
        value=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')
        printf '  "%s": "%s",\n' "$key" "$value"
    done
    echo "};"
} > /usr/share/nginx/html/env.js

exec nginx -g 'daemon off;'
