# FreshShare: context for Claude

FreshShare is a neighbourhood food-sharing web app: a map of free food from neighbours and community fridges within 2 km, designed so people trust what they pick up. This repo is a one-day hackathon build.

## Read these first
- `docs/02-product-spec.md`: scope (P0 / P1 / P2), acceptance criteria, product rules, copy.
- `docs/03-architecture.md`: stack, repo layout, Prisma schema, API, compose files.
- `docs/04-build-plan.md`: the block we are on (Tier 1 = must ship, Tier 2 = should, Tier 3 = stretch).
- `docs/01-survey-insights.md`: why each feature exists (17 survey responses from dev.freshshare.food).

## What the users told us (keep this in mind for every screen)
- Safety is the #1 worry (16 of 17). Every listing shows **photo, best-before date, origin label (homemade / packaged / fresh produce)**; photo and date are required.
- Strangers are worry #2 (11 of 17). Show a **verified badge and star rating** wherever a giver appears; hide the exact address until a reservation is confirmed; offer public handover spots.
- People don't know where to share (9) and the **map** is the most wanted feature (9). Map-first home, 2 km default radius.
- Nobody knows a community fridge nearby. Fridges live on the same map.
- "Keep it simple." Posting a listing should take under 30 seconds.

## Stack
React 18 + Vite + TypeScript + Tailwind + react-leaflet (OSM tiles) · Node 20 + Express + TypeScript + zod + Prisma + PostgreSQL 16 · JWT httpOnly cookie auth · multer + sharp for photos · Docker Compose + Caddy locally · AWS ECS (ALB, RDS, S3, Secrets Manager) via Terraform + GitHub Actions in `infra/` to **freshshare.de**.

## Deployment contract (see `infra/README.md`)
api on port 4000 with `GET /api/health` · web Caddy on 80 with `APP_DOMAIN=:80` · Dockerfiles `apps/api/Dockerfile` and `apps/web/Dockerfile` built from the repo root · `STORAGE_DRIVER=s3` + `S3_BUCKET` + `PUBLIC_IMAGE_BASE_URL` (`local` for compose) · `DATABASE_URL`, `JWT_SECRET` from Secrets Manager · migrations `npx prisma migrate deploy`.

## Conventions
- TypeScript strict everywhere. Validate every request body and query with zod.
- API errors: `{ "error": { "code": "...", "message": "..." } }` with the right HTTP status.
- Never return exact `lat`/`lng` of a listing to anyone except the giver or the confirmed receiver; list endpoints return `publicLat`/`publicLng`.
- Strip EXIF from uploads (sharp does this by default when re-encoding).
- Brand colours: green `#6b9f5e` (primary), orange `#e89344` (accent). Responsive **web app**: desktop browsers first (1440 px: top nav, list sidebar + map + detail panel), and it must still work in phone browsers at 390 px. Not a native mobile app.
- Demo-only shortcuts (e.g. phone verification code `123456`) must be marked `// DEMO` in code and labelled in the UI.
- Add or update a test for every API behaviour you change. Run `npm test` before saying a block is done.
- Commit at the end of every block with a clear message.

## Commands (once scaffolded)
- `docker compose -f infra/docker-compose.yml up --build`: full stack locally
- `npm run dev`: api + web in watch mode (needs the db container)
- `npm test`, `npm run lint`
- `npm run db:migrate`, `npm run db:seed` (`npx prisma db seed`: full reset, loads `data/seed.json` + `data/seed-photos/` through the storage module; on AWS run the deploy workflow with `seed=true`)
- `python3 scripts/check_seed.py`: validate seed data and its expected results

## Hard rules
- Do not deploy over the survey site on `dev.freshshare.food`; the app goes to `freshshare.de`.
- Never put survey respondent emails or other personal data in the repo, seed data, logs or the pitch.
- No raw meat or fish listings in the MVP.
