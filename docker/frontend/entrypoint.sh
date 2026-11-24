#!/bin/sh
set -e

API_UPSTREAM=${API_UPSTREAM:-talent-land-hackathon-api:8000}
sed -i "s/__API_UPSTREAM__/${API_UPSTREAM}/g" /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
