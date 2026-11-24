FROM node:24.19.0-alpine3.23 AS builder

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM nginx:1.31.1-alpine3.23-perl

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Next.js static export (output: "export" in client/next.config.ts).
COPY --from=builder /app/out /usr/share/nginx/html

COPY docker/frontend/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
