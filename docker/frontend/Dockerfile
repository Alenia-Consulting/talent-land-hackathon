FROM nginx:1.31.1-alpine3.23-perl

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

COPY client/src/index.html /usr/share/nginx/html/index.html

COPY docker/frontend/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
