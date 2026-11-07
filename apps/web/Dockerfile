# Build context: repo root.  docker build -f apps/web/Dockerfile .
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM caddy:2-alpine
ENV APP_DOMAIN=:80
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/www
EXPOSE 80
