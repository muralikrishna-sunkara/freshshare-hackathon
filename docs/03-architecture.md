# Architecture: built in a day, deployable by evening

Guiding rule from the survey: **keep it simple**. One repo, one database, one VM, one `docker compose up`.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Web app | React 18 + Vite + TypeScript + Tailwind CSS | Fast to scaffold, Claude knows it well. Responsive PWA instead of a native app. |
| Map | Leaflet via `react-leaflet` + OpenStreetMap tiles | No API key, no billing setup on the day. |
| API | Node 20 + Express + TypeScript + `zod` validation | Same stack as the earlier FreshShare platform, so you can reuse patterns. |
| ORM / DB | Prisma + PostgreSQL 16 | Typed models, migrations and seeding in one tool. Distance queries with a bounding box + Haversine in SQL (no PostGIS needed for the demo). |
| Auth | Email + password (bcrypt), JWT in an httpOnly cookie | No SMTP or OAuth setup on the day. |
| Images | `multer` upload → `sharp` resize to 1024 px WebP → `/uploads` volume | S3-compatible storage is a later swap behind one function. |
| Chat | REST + polling every 3 s | Socket.io is a stretch goal; polling is enough for a demo. |
| Tests | Vitest + Supertest for the API, Playwright smoke test for the happy path | One test per P0 flow. |
| Run | Docker Compose: `db`, `api`, `web` (Caddy serving the built SPA and proxying `/api`) | Same file locally and on the server. |
| CI/CD | GitHub Actions: lint + test → build images → push to GHCR → SSH deploy (`docker compose pull && up -d`) | One workflow file. |
| Hosting | One small VM (Hetzner CX22 or AWS t3.small) with Caddy auto-TLS | You already run dev.freshshare.food. |

> **Do not overwrite the survey.** dev.freshshare.food is collecting responses. Deploy the app to a new subdomain such as `app.dev.freshshare.food` (one extra DNS A record), or behind `/app`, and keep the survey running.

## Repository layout

```
freshshare-hackathon/
├── CLAUDE.md                 # context Claude reads on every session
├── apps/
│   ├── api/                  # Express + Prisma
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/seed.ts    # loads data/seed.json
│   │   └── src/{routes,services,middleware,lib}/
│   └── web/                  # React + Vite
│       └── src/{pages,components,api,hooks}/
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── Caddyfile
├── .github/workflows/ci-deploy.yml
├── data/                     # seed + anonymised survey
├── docs/                     # this kit
└── scripts/
```

## Data model

```prisma
enum Category   { leftovers fruit_veg bread packaged dairy other }
enum Origin     { homemade packaged fresh_produce }
enum ListingStatus { available reserved collected expired removed }
enum ClaimStatus   { pending confirmed collected cancelled lapsed }
enum FridgeState   { stocked empty needs_cleaning }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String
  homeLat       Float
  homeLng       Float
  emailVerified Boolean  @default(false)
  phoneVerified Boolean  @default(false)
  ratingAvg     Float    @default(0)
  ratingCount   Int      @default(0)
  createdAt     DateTime @default(now())
  listings      Listing[]
  claims        Claim[]
}

model Listing {
  id           String        @id @default(cuid())
  giverId      String
  giver        User          @relation(fields: [giverId], references: [id])
  title        String
  description  String?
  category     Category
  origin       Origin
  allergens    String[]
  bestBefore   DateTime
  photoUrl     String
  lat          Float
  lng          Float
  publicLat    Float          // jittered ~150 m, shown until a claim is confirmed
  publicLng    Float
  handoverSpot String?        // e.g. "Bakery at Hauptstraße corner"
  pickupFrom   DateTime
  pickupUntil  DateTime
  portions     Int           @default(1)
  status       ListingStatus @default(available)
  createdAt    DateTime      @default(now())
  claims       Claim[]
  @@index([status, lat, lng])
}

model Claim {
  id          String      @id @default(cuid())
  listingId   String
  listing     Listing     @relation(fields: [listingId], references: [id])
  receiverId  String
  receiver    User        @relation(fields: [receiverId], references: [id])
  status      ClaimStatus @default(pending)
  holdUntil   DateTime
  createdAt   DateTime    @default(now())
  messages    Message[]
  ratings     Rating[]
}

model Message {
  id        String   @id @default(cuid())
  claimId   String
  claim     Claim    @relation(fields: [claimId], references: [id])
  senderId  String
  body      String
  createdAt DateTime @default(now())
}

model Rating {
  id         String   @id @default(cuid())
  claimId    String
  claim      Claim    @relation(fields: [claimId], references: [id])
  fromUserId String
  toUserId   String
  stars      Int      // 1..5
  note       String?
  createdAt  DateTime @default(now())
  @@unique([claimId, fromUserId])
}

model Fridge {
  id           String          @id @default(cuid())
  name         String
  address      String
  lat          Float
  lng          Float
  openingHours String
  checkIns     FridgeCheckIn[]
}

model FridgeCheckIn {
  id        String      @id @default(cuid())
  fridgeId  String
  fridge    Fridge      @relation(fields: [fridgeId], references: [id])
  userId    String
  state     FridgeState
  createdAt DateTime    @default(now())
}

model AlertSubscription {
  id         String     @id @default(cuid())
  userId     String
  lat        Float
  lng        Float
  radiusM    Int        @default(2000)
  categories Category[]
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  listingId String?
  text      String
  readAt    DateTime?
  createdAt DateTime @default(now())
}

model Report {
  id        String   @id @default(cuid())
  listingId String
  userId    String
  reason    String
  createdAt DateTime @default(now())
}
```

"Verified" is derived: `emailVerified && phoneVerified`.

## API

All routes under `/api`, JSON, `zod`-validated, errors as `{ error: { code, message } }`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | name, email, password, homeLat, homeLng |
| POST | `/auth/login` / `/auth/logout` | Sets / clears the cookie |
| GET | `/me` | Current user + stats |
| GET | `/listings?lat&lng&radius=2000&category=` | Available listings nearby, sorted by distance, `publicLat/Lng` only |
| GET | `/listings/:id` | Detail; exact location only for the giver or a confirmed receiver |
| POST | `/listings` | multipart: photo + fields; enforces photo, date, safety checklist |
| PATCH | `/listings/:id` | Giver edits or removes |
| POST | `/listings/:id/claims` | Reserve: 30-minute hold |
| POST | `/claims/:id/confirm` / `/collected` / `/cancel` | Status transitions (giver confirms, either marks collected) |
| GET / POST | `/claims/:id/messages?after=` | Chat (poll with `after` timestamp) |
| POST | `/claims/:id/ratings` | 1 to 5 stars, once per side; updates `ratingAvg` |
| GET | `/fridges?lat&lng&radius` | Fridges with latest check-in |
| POST | `/fridges/:id/checkins` | stocked / empty / needs_cleaning |
| GET / PUT | `/alerts` | Read / set the user's subscription |
| GET | `/notifications` | In-app alert feed |
| GET | `/impact?lat&lng&radius` | Portions and kg saved this week, nearby and personal |
| POST | `/listings/:id/report` | Report a listing |
| GET | `/health` | For uptime checks and the deploy smoke test |

Background job (a `setInterval` in the API process is fine for the demo): every minute, lapse expired holds, expire listings past `bestBefore` or 48 h for homemade, and create notifications for new listings matching alert subscriptions.

## Distance query

```sql
-- $1 lat, $2 lng, $3 radius in metres; bounding box first, then Haversine
SELECT *, 6371000 * 2 * asin(sqrt(
  power(sin(radians(lat - $1) / 2), 2) +
  cos(radians($1)) * cos(radians(lat)) * power(sin(radians(lng - $2) / 2), 2)
)) AS distance_m
FROM "Listing"
WHERE status = 'available'
  AND lat BETWEEN $1 - ($3 / 111320.0) AND $1 + ($3 / 111320.0)
  AND lng BETWEEN $2 - ($3 / (111320.0 * cos(radians($1)))) AND $2 + ($3 / (111320.0 * cos(radians($1))))
ORDER BY distance_m
LIMIT 100;
```

(Filter `distance_m <= $3` in an outer query or in code.)

## Security and privacy checklist

- [ ] Passwords hashed with bcrypt (cost 12); JWT secret from env, cookie `httpOnly`, `secure`, `sameSite=lax`.
- [ ] `helmet`, CORS limited to the app origin, request body limits, 5 MB image limit, only `image/*` accepted, EXIF stripped by `sharp` (removes GPS from photos).
- [ ] Exact location never returned in list endpoints.
- [ ] Rate limit `/auth/*` and `POST /listings`.
- [ ] Secrets only in `.env` on the server and GitHub Actions secrets; `.env.example` committed.
- [ ] Survey respondent emails never enter this repo or the app database.

## Ops (day-one minimum)

- **Environments:** local (`docker compose up`) and `app.dev.freshshare.food`.
- **Health:** `/api/health` checks the DB; the deploy job curls it and fails the run if it is not 200.
- **Logs:** `pino` JSON logs to stdout; `docker compose logs -f api`.
- **Backups:** nightly `pg_dump` cron to the VM's disk (plus off-box copy after the hackathon).
- **Rollback:** images tagged with the git SHA; redeploy the previous tag.
- **Later:** managed Postgres, S3 for photos, uptime monitor, Sentry.

## Example `infra/docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: freshshare
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-freshshare}
      POSTGRES_DB: freshshare
    volumes: [dbdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U freshshare"]
      interval: 5s
      retries: 10
  api:
    build: ../apps/api
    env_file: ../.env
    environment:
      DATABASE_URL: postgresql://freshshare:${POSTGRES_PASSWORD:-freshshare}@db:5432/freshshare
    depends_on:
      db: { condition: service_healthy }
    volumes: [uploads:/app/uploads]
  web:
    build: ../apps/web
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - uploads:/srv/uploads:ro
      - caddydata:/data
    depends_on: [api]
volumes: { dbdata: {}, uploads: {}, caddydata: {} }
```

## Example `infra/Caddyfile`

```
{$APP_DOMAIN:localhost} {
  encode gzip
  handle /api/* { reverse_proxy api:4000 }
  handle /uploads/* { root * /srv; file_server }
  handle { root * /srv/www; try_files {path} /index.html; file_server }
}
```
