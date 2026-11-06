# Build plan for tomorrow (with Claude)

A 10-hour day, split into blocks that each end with something you can click. Each block has a **copy-paste prompt** for Claude Code. Commit at the end of every block.

## Before you start (tonight, 15 minutes)

- [ ] Node 20+, Docker Desktop (or Docker Engine), Git, and Claude Code installed. `claude --version` works.
- [ ] Clone this repo and check out a working branch, e.g. `git checkout -b build/mvp`.
- [ ] Read [`CLAUDE.md`](../CLAUDE.md), [`02-product-spec.md`](02-product-spec.md) and [`03-architecture.md`](03-architecture.md) once.
- [ ] DNS: add an A record for `app.dev.freshshare.food` pointing at the VM (so TLS works when you deploy in the evening).
- [ ] On the VM: Docker installed, a deploy user with your SSH key, ports 80/443 open.
- [ ] GitHub repo secrets ready: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `JWT_SECRET`, `POSTGRES_PASSWORD`.
- [ ] Charge your phone: you will demo on it.

## How to work with Claude tomorrow

- Start each block in **plan mode** (Shift+Tab in Claude Code), read the plan, then let it build. Plans catch wrong assumptions before code is written.
- One block = one focused prompt. If a session gets long, `/clear` and start the next block fresh. `CLAUDE.md` carries the context.
- Always end a block with: "Run the tests and the app, show me it works, then commit."
- When something breaks, paste the exact error and say what you expected. Don't let it guess.
- Keep a `docs/DECISIONS.md` log; ask Claude to append a line whenever you change the plan.

## Schedule

| Time | Block | Done when |
|---|---|---|
| 09:00 | 0. Scaffold | `docker compose up` shows a blank web app and `/api/health` = ok |
| 09:45 | 1. Data + API core | Seeded DB, listings endpoint returns nearby food |
| 11:00 | 2. Map home + listing card | Map with pins, trust-first cards, radius filter |
| 12:15 | 3. Auth + post listing | Sign up, post with photo/date/label/checklist, appears on map |
| 13:15 | Lunch | |
| 14:00 | 4. Reserve + chat | Reserve, confirm, chat, mark collected |
| 15:15 | 5. Ratings + verified badge | Stars after pickup, badge and average on profile/cards |
| 16:00 | 6. Fridges + handover spots | Fridge layer with check-ins |
| 16:45 | 7. Alerts + impact | Notification feed, impact banner |
| 17:30 | 8. Deploy | Live at app.dev.freshshare.food with seeded demo data |
| 18:30 | 9. Polish + tests | Happy-path Playwright test green, mobile layout checked |
| 19:15 | 10. Pitch rehearsal | Two full run-throughs with the live demo |

If you fall behind, cut in this order: 7 (alerts), then fridge check-ins (keep the fridge pins), then chat quick replies. Never cut photo + date + label, verified badge, or ratings: they are the survey story.

---

## Block 0: Scaffold (45 min)

```text
Read CLAUDE.md and docs/03-architecture.md. Scaffold the monorepo exactly as described:
- apps/api: Node 20 + Express + TypeScript + Prisma + zod + pino, with GET /api/health that checks the DB.
- apps/web: React + Vite + TypeScript + Tailwind + react-leaflet, with one page showing a full-screen OpenStreetMap centred on Erlangen (49.5897, 11.0040).
- infra/docker-compose.yml and infra/Caddyfile as in the architecture doc, Dockerfiles for api (multi-stage) and web (build with node, serve with caddy).
- Root package.json with npm workspaces and scripts: dev, build, test, lint, db:migrate, db:seed.
- .env.example with every variable, .gitignore, and a short README "Run locally" section.
Use plan mode first. When done, run `docker compose -f infra/docker-compose.yml up --build`, curl /api/health, and commit.
```

## Block 1: Data model + API core (75 min)

```text
Implement the Prisma schema from docs/03-architecture.md (all models and enums). Create the first migration.
Write prisma/seed.ts that loads data/seed.json (users, listings, fridges, check-ins). Hash seed passwords with bcrypt. Compute publicLat/publicLng by jittering lat/lng by a random 100-200 m. Set listing dates relative to "now" using the offsets in the seed file so the demo always looks fresh.
Implement GET /api/listings?lat&lng&radius&category using the bounding-box + Haversine query from the doc, returning only public coordinates, distance in metres, giver name, verified flag (emailVerified && phoneVerified), ratingAvg and ratingCount. Implement GET /api/listings/:id with the exact-location rule.
Add Vitest + Supertest tests: radius filtering, exact location hidden from strangers, expired listings excluded. Run tests, then commit.
```

## Block 2: Map home + trust-first listing card (75 min)

```text
Build the map home screen from docs/02-product-spec.md:
- Full-screen Leaflet map, user's location via the browser (fallback Erlangen), radius chips 500 m / 1 km / 2 km (default 2 km) drawn as a circle, category chips.
- Pins coloured by category; tapping a pin opens a bottom sheet with the listing card.
- The listing card must show: photo, title, best-before date chip, origin label chip (Homemade / Packaged / Fresh produce), allergens if any, giver name with a green "Verified" badge and star rating, distance, "posted X min ago".
- A list/map toggle; list sorted by distance.
- Banner at the top for the impact counter (placeholder number for now).
- Empty state: "Nothing within 2 km yet. There are N community fridges nearby."
Brand colours: green #6b9f5e, orange #e89344. Mobile-first: design for a 390 px wide screen, then check desktop.
Use TanStack Query for data fetching. Show me screenshots at phone width, then commit.
```

## Block 3: Auth + post a listing (60 min)

```text
Add auth: POST /api/auth/register, /login, /logout, GET /api/me, JWT in an httpOnly cookie, bcrypt, zod validation, rate limiting on auth routes. Registration asks for name, email, password and home location picked on a small map.
Web: sign-up, sign-in, and a protected route wrapper.
Then build "Share food" (POST /api/listings, multipart): photo (camera capture on mobile), title, category, origin label, best-before date, pickup window, portions, optional allergens, optional handover spot, and a 3-item safety checklist that must all be ticked ("Stored cold", "Not past its date", "I would eat it myself"). Photo and date are required. Reject raw meat/fish (category rule) with a friendly message.
Server: multer + sharp, resize to max 1024 px WebP, strip EXIF, 5 MB limit, image types only. Homemade listings expire after 48 h max.
After posting, return to the map focused on the new pin. Goal: a new user can post in under 30 seconds. Test it, then commit.
```

## Block 4: Reserve + chat (75 min)

```text
Implement the claim flow from docs/03-architecture.md:
- POST /api/listings/:id/claims creates a pending claim with a 30-minute hold and sets the listing to reserved. Only one active claim per listing.
- Giver confirms (POST /claims/:id/confirm): receiver now sees the exact address or handover spot.
- Either side marks collected; receiver or giver can cancel; a background interval lapses holds that expire and frees the listing.
- Chat per claim: GET/POST /api/claims/:id/messages?after=, polled every 3 s in the UI. Quick replies: "On my way", "Running 5 min late", "Can we meet somewhere public?".
- Web: Reserve button on the card with the copy "You'll get the exact address once {giver} confirms. Meet in a public place if you prefer.", a "My pickups" page, and the chat screen with status at the top.
Write API tests for the state transitions (including double-reserve and lapsed holds). Run them, then commit.
```

## Block 5: Ratings + verified badge (45 min)

```text
After a claim is collected, prompt both sides to rate each other (1-5 stars, optional note). POST /api/claims/:id/ratings, one rating per side, recompute ratingAvg/ratingCount on the rated user in a transaction.
Verified badge = emailVerified && phoneVerified. For the demo, add a fake "Verify phone" step on the profile that accepts code 123456 and sets phoneVerified, clearly marked DEMO in the code and UI.
Profile page: name, badge, rating, items shared, items received, kg saved (0.4 kg per portion, labelled as an estimate), alert settings link.
Show the badge and rating everywhere a giver appears. Test, then commit.
```

## Block 6: Community fridges + handover spots (45 min)

```text
Add the fridge layer: GET /api/fridges?lat&lng&radius returning each fridge with its latest check-in; POST /api/fridges/:id/checkins with state stocked / empty / needs_cleaning.
Map: fridges with a distinct fridge icon and a layer toggle. Fridge sheet: name, address, opening hours, "last checked 25 min ago: stocked", and three check-in buttons.
In the share form, offer "Handover spot" suggestions: nearby fridges plus a free-text public place.
Commit when it works on a phone-sized screen.
```

## Block 7: Alerts + impact counter (45 min)

```text
Alerts: GET/PUT /api/alerts (radius + categories). The background job creates a Notification for each subscriber when a matching listing is posted within their radius. Web: bell icon with unread count and a notification list that opens the listing.
Impact: GET /api/impact?lat&lng&radius returns portions and estimated kg collected this week within the radius, plus the user's own totals. Replace the banner placeholder: "This week your neighbourhood saved {portions} portions (~{kg} kg)".
Commit.
```

## Block 8: Deploy (60 min)

```text
Create infra/docker-compose.prod.yml (images from ghcr.io/<owner>/freshshare-api and -web tagged by git SHA, APP_DOMAIN=app.dev.freshshare.food, restart: unless-stopped) and .github/workflows/ci-deploy.yml:
1. On push to main: npm ci, lint, test (with a postgres service container).
2. Build and push both images to GHCR with tags sha and latest.
3. SSH to DEPLOY_HOST as DEPLOY_USER, write .env from secrets, docker compose pull && up -d, run prisma migrate deploy, then seed only if the DB is empty.
4. curl -f https://app.dev.freshshare.food/api/health or fail the job.
Do not touch the existing survey site on dev.freshshare.food. Explain any manual steps I need to do on the server.
```

## Block 9: Polish + tests (45 min)

```text
Write one Playwright test for the demo path: sign in as the seeded receiver, see listings on the map, open a homemade listing, check the date, label and verified badge are visible, reserve, send a chat message, (as giver) confirm, mark collected, rate 5 stars, see the impact counter go up.
Then do a polish pass at 390 px width: tap targets at least 44 px, loading and error states on every fetch, no layout shift on the bottom sheet, readable contrast for the brand colours. List anything you could not fix.
```

## Block 10: Pitch rehearsal (45 min)

Use [`pitch/PITCH.md`](../pitch/PITCH.md). Reset the demo data (`npm run db:seed` on the server) right before you present, and keep a 60-second screen recording of the demo as a backup in case the venue Wi-Fi fails.

---

## Handy extra prompts

**When stuck on a bug**
```text
Here is the exact error and what I did: <paste>. Expected: <x>. Don't change unrelated code. Find the root cause first, explain it in two sentences, then fix it and add a test that would have caught it.
```

**Before committing**
```text
Review the diff for security issues (auth checks on every claim/listing route, exact location leaks, file upload validation) and for anything that breaks the demo path. Fix what you find.
```

**P2 stretch: photo autofill with the Claude API**
```text
Add POST /api/listings/suggest that sends the uploaded photo to the Claude API (model from env CLAUDE_MODEL, key from ANTHROPIC_API_KEY) and returns a suggested title, category and likely allergens as JSON. Pre-fill the share form with it; the user can edit everything. Fail silently if the key is missing.
```

**Re-analyse a new survey export**
```text
Run python3 scripts/analyze_survey.py <new-export.csv>, compare it with docs/01-survey-insights.md, and update the numbers and the "Decisions for the build" table. Never copy emails or other personal data into the repo.
```
