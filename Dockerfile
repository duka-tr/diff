FROM nginxinc/nginx-unprivileged:stable-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
COPY --chmod=755 docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh

EXPOSE 8080
