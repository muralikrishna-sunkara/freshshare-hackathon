# Build context: repo root.  docker build -f apps/api/Dockerfile .
FROM node:20-bookworm-slim AS base
# fonts-dejavu-core: sharp renders the impact share cards (SVG text) with it
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates fonts-dejavu-core fontconfig \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# All deps (for the TypeScript build)
FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
RUN npm ci -w apps/api --include-workspace-root
COPY apps/api apps/api
RUN npm run build -w apps/api

# Production deps only (prisma CLI and tsx stay: migrations and seed run in this image)
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
RUN npm ci -w apps/api --include-workspace-root --omit=dev && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOADS_DIR=/app/uploads \
    SEED_DATA_DIR=/app/data \
    PATH=/app/node_modules/.bin:$PATH
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/package.json /app/package.json
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY apps/api/package.json /app/apps/api/package.json
COPY apps/api/prisma /app/apps/api/prisma
COPY apps/api/src /app/apps/api/src
COPY apps/api/tsconfig.json /app/apps/api/tsconfig.json
# Seed data + photos so `npx prisma db seed` works as a one-off ECS task
COPY data/seed.json /app/data/seed.json
COPY data/seed-photos /app/data/seed-photos
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/src/index.js"]
