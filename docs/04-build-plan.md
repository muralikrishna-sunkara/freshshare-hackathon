# Build plan for tomorrow (with Claude)

Every block ends with something you can click and has a **copy-paste prompt** for Claude Code. The blocks are grouped into **three tiers**, so you can stop at any tier boundary and still have a demo that works.

## Before you start

- [x] AWS infra is live (ECS, ALB, RDS, S3 + CloudFront, Secrets Manager); see [`infra/README.md`](../infra/README.md). The hello-world app answers on the ALB today.
- [x] Domain chosen: **freshshare.de** (Route 53). HTTPS switches on once DNS has propagated.
- [ ] Before 09:00, open https://freshshare.de and check the hello-world page loads over HTTPS. If it doesn't, use the ALB URL from `infra/README.md` for the morning and keep going.
- [ ] Node 20+, Docker Desktop, Git and Claude Code installed; `claude --version` works.
- [ ] `git pull` on `main`, then `git checkout -b build/mvp`.
- [ ] Read [`CLAUDE.md`](../CLAUDE.md), [`02-product-spec.md`](02-product-spec.md) and [`03-architecture.md`](03-architecture.md) once.
- [ ] `python3 scripts/check_seed.py` prints `seed OK` (the demo data and its 14 images are already in `data/`).
- [ ] Charge your phone: you will demo on it.

## Pick your tier by the time you have

| Tier | Blocks | Time | What you can demo when it's done |
|---|---|---|---|
| **Tier 1: must ship** | 0 to 7 | about 6.5 h | Map of trusted food on freshshare.de: photo + date + label cards, verified badges, sign up, post in 30 s, reserve, confirm, collect, rate. Seeded, deployed, happy-path test green. **This is the pitch.** |
| **Tier 2: should ship** | 8 to 11 | about 2.5 h | Pickup chat, community fridge layer with check-ins, impact counter, mobile polish. Turns the demo from "works" into "wins". |
| **Tier 3: stretch** | S1 to S6 | 30 to 60 min each | Alerts, public handover spots, Claude photo autofill, expiry reminders, German UI, real-time chat. Pick by what the room cares about. |

- **About 6 hours:** Tier 1 only. Skip chat in the demo and show the fridge pins as seeded data.
- **About 9 hours:** Tier 1 + Tier 2. This is the plan below.
- **10+ hours:** add Tier 3 items in the order listed (S1 alerts first).

Rules that hold at every tier: never cut **photo + date + label**, **verified badge** or **ratings**, because they are the survey story. Merge to `main` at the end of every block: the deploy workflow ships `apps/**` changes to freshshare.de automatically, so you always have a live version.

## Full-day schedule

| Time | Tier | Block | Done when |
|---|---|---|---|
| 09:00 | 1 | 0. Scaffold | `docker compose up` shows the map; `/api/health` is ok |
| 09:45 | 1 | 1. Data model, API core, seed | Seeded DB with images; nearby listings endpoint passes the seed's expected results |
| 11:00 | 1 | 2. Map home + trust-first card | Map with pins, cards with photo/date/label/badge, radius filter |
| 12:00 | 1 | 3. First deploy to freshshare.de | Real app live on AWS with seed data and photos in S3 |
| 12:45 | | Lunch | |
| 13:30 | 1 | 4. Auth + post a listing | Sign up, post with photo/date/label/checklist, appears on map |
| 14:30 | 1 | 5. Reserve, confirm, collect | Hold, confirm, exact address revealed, collected |
| 15:15 | 1 | 6. Ratings + verified badge | Stars after pickup, DEMO phone verification |
| 16:00 | 1 | 7. Demo-path test + reset | Playwright happy path green; reseed works. **Tier 1 complete** |
| 16:30 | 2 | 8. Pickup chat | Chat with quick replies inside a claim |
| 17:15 | 2 | 9. Community fridges | Fridge layer, check-ins |
| 17:50 | 2 | 10. Impact counter | Banner and profile totals |
| 18:20 | 2 | 11. Mobile polish | 390 px pass, loading/error states. **Tier 2 complete** |
| 19:00 | | Pitch rehearsal | Reseed, two full run-throughs, backup recording |
| any spare | 3 | S1 to S6 | |

## How to work with Claude tomorrow

- Start each block in **plan mode** (Shift+Tab in Claude Code), read the plan, then let it build. Plans catch wrong assumptions before code is written.
- One block = one focused prompt. When a session gets long, `/clear` and start the next block fresh. `CLAUDE.md` carries the context.
- End every block with: "Run the tests and the app, show me it works, then commit."
- When something breaks, paste the exact error and say what you expected. Don't let it guess.
- Keep a `docs/DECISIONS.md` log; ask Claude to append a line whenever you change the plan.

---

# Tier 1: must ship

## Block 0: Scaffold (45 min)

```text
Read CLAUDE.md, docs/03-architecture.md and infra/README.md. Scaffold the monorepo exactly as described:
- apps/api: Node 20 + Express + TypeScript + Prisma + zod + pino, listening on PORT (default 4000), with GET /api/health that checks the DB.
- apps/web: React + Vite + TypeScript + Tailwind + react-leaflet, one page with a full-screen OpenStreetMap centred on Erlangen (49.5897, 11.0040).
- Dockerfiles at apps/api/Dockerfile (multi-stage, linux/amd64, keeps the prisma CLI and COPIES data/seed.json and data/seed-photos/ into the image so the seed can run on ECS) and apps/web/Dockerfile (build with node, serve with Caddy on port 80 using APP_DOMAIN). Both build with the REPO ROOT as context.
- infra/docker-compose.yml and infra/Caddyfile as in the architecture doc (STORAGE_DRIVER=local). Do not change anything that infra/README.md or .github/workflows already define.
- Root package.json with npm workspaces and scripts: dev, build, test, lint, db:migrate, db:seed.
- .env.example with every variable from the deployment contract, and a short "Run locally" section in README.md.
Use plan mode first. When done, run `docker compose -f infra/docker-compose.yml up --build`, curl /api/health, and commit.
```

## Block 1: Data model, API core and seed (75 min)

```text
Implement the Prisma schema from docs/03-architecture.md (all models and enums) and create the first migration.

Storage module first (apps/api/src/lib/storage.ts): put(key, buffer, contentType) and publicUrl(key), with two drivers chosen by STORAGE_DRIVER: "local" writes to the uploads volume and serves /uploads/<key>; "s3" uses @aws-sdk/client-s3 (credentials from the ECS task role) to write S3_BUCKET/<key> and returns `${PUBLIC_IMAGE_BASE_URL}/<key>`.

Seed (apps/api/prisma/seed.ts), wired as "prisma": { "seed": "tsx prisma/seed.ts" } in apps/api/package.json so `npx prisma db seed` runs it (the deploy workflow runs exactly that on ECS):
- Treat it as a FULL RESET of the demo database: delete all rows in dependency order, then load data/seed.json. Log what it did.
- Users: hash demoPassword with bcrypt. Listings: lat/lng = the giver's home; publicLat/publicLng jittered 100-200 m with a fixed random seed so tests are stable; all times = now + the *OffsetMin values; status, reservedBy and collectedBy as given.
- Photos: read each listing's data/seed-photos/<photo>, convert with sharp to 1024 px WebP, and upload through the storage module as listings/<listingId>.webp (fridges as fridges/<fridgeId>.webp). Store the public URL.
- Claims, messages, ratings, fridge check-ins and alert subscriptions from the file. Recompute ratingAvg/ratingCount only for users who have seeded ratings; keep the file's values for the others.
- Locate seed.json relative to the repo root locally and to /app/data in the image (env SEED_DATA_DIR overrides).

API: GET /api/listings?lat&lng&radius&category with the bounding-box + Haversine query from the doc (status available only), returning public coordinates, distance, giver name, verified (emailVerified && phoneVerified), ratingAvg, ratingCount and photoUrl. GET /api/listings/:id with the exact-location rule.

Tests (Vitest + Supertest, real Postgres): seed the DB, then assert data/seed.json "expectedResults" from mapCentre: availableWithin2km, availableWithin10km, neverListed never returned, verified/unverified givers, and exact lat/lng never present in list responses. Run the tests, then commit.
```

## Block 2: Map home + trust-first listing card (60 min)

```text
Build the map home screen from docs/02-product-spec.md:
- Full-screen Leaflet map, the user's location from the browser (fallback mapCentre from seed.json), radius chips 500 m / 1 km / 2 km (default 2 km) drawn as a circle, category chips.
- Pins coloured by category; tapping a pin opens a bottom sheet with the listing card.
- The card must show: photo, title, best-before date chip, origin chip (Homemade / Packaged / Fresh produce), allergens if any, giver name with a green "Verified" badge (only when verified) and star rating, distance, "posted X min ago".
- List/map toggle; list sorted by distance.
- Impact banner at the top (placeholder number for now).
- Empty state: "Nothing within 2 km yet. There are N community fridges nearby."
Brand colours: green #6b9f5e, orange #e89344. Mobile-first at 390 px, then check desktop. Use TanStack Query.
Check with the seed: 8 pins within 2 km, Priya's dal has no Verified badge, the soup never shows. Show me screenshots at phone width, then commit.
```

## Block 3: First deploy to freshshare.de (45 min)

```text
Read infra/README.md ("Tomorrow: switching to the real app") and the "Deployment contract (AWS ECS)" in docs/03-architecture.md. Check the app meets every row of the contract: api on 4000 with GET /api/health, web Caddy on 80 with APP_DOMAIN=:80, Dockerfiles at apps/api/Dockerfile and apps/web/Dockerfile building from the repo root for linux/amd64, STORAGE_DRIVER=s3 with S3_BUCKET and PUBLIC_IMAGE_BASE_URL, DATABASE_URL and JWT_SECRET from the environment, `npx prisma migrate deploy` available, `prisma.seed` set in apps/api/package.json, and data/ copied into the api image.
Fix gaps in the app, not in Terraform or the workflows. Then tell me to merge to main and run the "App build and deploy" workflow with seed=true. After it finishes, curl -f https://freshshare.de/api/health and fetch /api/listings near Erlangen to confirm 8 listings with S3/CloudFront photo URLs.
Never touch the survey on dev.freshshare.food. List any manual AWS steps I still need to do.
```

From now on, every merge to `main` that touches `apps/**` deploys automatically. Re-run the workflow with `seed=true` whenever you want fresh demo data.

## Block 4: Auth + post a listing (60 min)

```text
Add auth: POST /api/auth/register, /login, /logout, GET /api/me, JWT in an httpOnly cookie (JWT_SECRET), bcrypt, zod validation, rate limiting on auth routes. Registration asks for name, email, password and home location picked on a small map.
Web: sign-up, sign-in and a protected-route wrapper. Seeded users log in with the demoPassword from seed.json.
Then build "Share food" (POST /api/listings, multipart): photo (camera capture on mobile), title, category, origin label, best-before date, pickup window, portions, optional allergens, optional handover spot, and a 3-item safety checklist that must all be ticked ("Stored cold", "Not past its date", "I would eat it myself"). Photo and date are required. Reject raw meat/fish with a friendly message. Homemade listings expire after 48 h max.
Server: multer + sharp, max 1024 px WebP, strip EXIF, 5 MB limit, image types only, saved through the storage module as listings/<id>.webp.
After posting, return to the map focused on the new pin. Goal: a new user posts in under 30 seconds. Add API tests for the validation rules, then commit.
```

## Block 5: Reserve, confirm, collect (45 min)

```text
Implement the claim flow from docs/03-architecture.md (no chat yet):
- POST /api/listings/:id/claims creates a pending claim with a 30-minute hold and sets the listing to reserved. One active claim per listing; a giver can't claim their own listing.
- Giver confirms (POST /claims/:id/confirm); only then does the receiver see the exact address or handover spot.
- Either side marks collected; either side can cancel; a background interval lapses expired holds and frees the listing.
- Web: Reserve button with the copy "You'll get the exact address once {giver} confirms. Meet in a public place if you prefer.", a "My pickups" page, and a claim screen with the status at the top and the giver's Confirm button.
Tests: double-reserve is rejected (the seeded bread rolls are already reserved by Ben), lapsed holds free the listing, exact location appears only after confirm. Run them, then commit.
```

## Block 6: Ratings + verified badge (45 min)

```text
After a claim is collected, prompt both sides to rate each other (1-5 stars, optional note). POST /api/claims/:id/ratings, one rating per side, recompute ratingAvg/ratingCount on the rated user in a transaction.
Verified badge = emailVerified && phoneVerified. Add a "Verify phone" step on the profile that accepts code 123456 and sets phoneVerified, marked // DEMO in code and labelled DEMO in the UI (test it with the seeded user Ben).
Profile page: name, badge, rating, items shared, items received, and a pickup history (Sara already has a collected, rated pickup in the seed).
Show the badge and rating everywhere a giver appears. Test, then commit.
```

## Block 7: Demo-path test + reset (30 min)

```text
Write one Playwright test of the pitch demo path against a freshly seeded database: log in as Sara, see 8 listings within 2 km, open "Vegetable lasagne", check the photo, the "Homemade" label, the best-before date, the Verified badge and 4.9 rating are visible, reserve; log in as Anna in a second browser context and confirm; back as Sara, see the exact address, mark collected, rate 5 stars.
Add `npm run e2e` (with --trace off) and make it run in CI after the API tests. Then run the deploy workflow with seed=true and run the same test against https://freshshare.de with BASE_URL set. Commit.
```

**Tier 1 is complete.** Merge, check freshshare.de on your phone, and record a 60-second backup video of the demo path now, while it works.

---

# Tier 2: should ship

## Block 8: Pickup chat (40 min)

```text
Add chat inside a claim: GET/POST /api/claims/:id/messages?after=, only for the giver and receiver of that claim, polled every 3 s in the UI. Quick replies: "On my way", "Running 5 min late", "Can we meet somewhere public?". Show the seeded conversation on Sara's collected pears pickup.
Add the chat step to the Playwright demo test. Test authorisation (a third user gets 403), then commit.
```

## Block 9: Community fridges (35 min)

```text
Add the fridge layer: GET /api/fridges?lat&lng&radius returning each fridge with its photo and latest check-in; POST /api/fridges/:id/checkins with state stocked / empty / needs_cleaning.
Map: fridges with a distinct fridge icon and a layer toggle. Fridge sheet: photo, name, address, opening hours, "last checked 25 min ago: stocked", and three check-in buttons. The empty-map state now uses the real fridge count.
Commit when it works at phone width.
```

## Block 10: Impact counter (30 min)

```text
GET /api/impact?lat&lng&radius returns portions collected this week within the radius (plus impactBaseline.portionsThisWeek from the seed config, stored in a Setting row) and the user's own totals, with kg as portions × 0.4, labelled as an estimate.
Replace the banner placeholder: "This week your neighbourhood saved {portions} portions (~{kg} kg)". Show personal totals on the profile. The number must go up after the demo pickup; add that assertion to the Playwright test. Commit.
```

## Block 11: Mobile polish (40 min)

```text
Polish pass at 390 px width on every screen: tap targets at least 44 px, loading and error states on every fetch, no layout shift on the bottom sheet, readable contrast for the brand colours (use #3E6B35 for green text on light backgrounds), images lazy-loaded with fixed aspect ratio. Add a web app manifest and icons so it can be added to the home screen. List anything you could not fix, then commit.
```

**Tier 2 is complete.** Reseed (workflow with `seed=true`) and rehearse the pitch.

---

# Tier 3: stretch (pick any, in this order)

## S1: Nearby alerts (45 min)

```text
GET/PUT /api/alerts (radius + categories). The background job creates a Notification for each subscriber when a matching listing is posted within their radius (Sara has a seeded subscription). Web: bell icon with unread count and a list that opens the listing. Optional: also publish to SNS_NOTIFICATIONS_ARN. Commit.
```

## S2: Public handover spots (30 min)

```text
In the share form, offer "Handover spot" suggestions: nearby fridges plus a free-text public place. Show the spot on the card ("Handover: Demo Fridge: Parish Hall") and reveal it, instead of the home address, after confirmation. The seeded apples already use one. Commit.
```

## S3: Photo autofill with the Claude API (45 min)

```text
Add POST /api/listings/suggest that sends the uploaded photo to the Claude API (model from env CLAUDE_MODEL, key from ANTHROPIC_API_KEY) and returns a suggested title, category and likely allergens as JSON. Pre-fill the share form; the user can edit everything. Fail silently if the key is missing. Never let it fill the best-before date.
```

## S4: "Expiring soon? Share it" reminder (45 min)

```text
Let a user log an item in their own fridge with a date. The background job creates a notification the day before: "Your yoghurt expires tomorrow. Share it?" with a button that opens the share form pre-filled. This targets the survey's #1 cause of waste (forgot, 12 of 17).
```

## S5: German UI (30 min)

```text
Add react-i18next with English and German, a language switch in the profile, and German as the default when the browser language is de. Translate every UI string, including the safety checklist and the DEMO labels.
```

## S6: Real-time chat (45 min)

```text
Replace chat polling with Socket.io behind the ALB (check infra/README.md for the target group's stickiness and idle-timeout settings first; fall back to polling if the socket drops).
```

---

## Pitch rehearsal (45 min)

Use [`pitch/PITCH.md`](../pitch/PITCH.md). Run the deploy workflow with `seed=true` right before you present, and keep the 60-second backup recording on your laptop in case the venue Wi-Fi fails.

## Handy extra prompts

**When stuck on a bug**
```text
Here is the exact error and what I did: <paste>. Expected: <x>. Don't change unrelated code. Find the root cause first, explain it in two sentences, then fix it and add a test that would have caught it.
```

**Before merging a block**
```text
Review the diff for security issues (auth checks on every claim/listing route, exact location leaks, file upload validation) and for anything that breaks the demo path. Fix what you find.
```

**Deploy failed**
```text
The "App build and deploy" workflow failed. Read the failed job's logs, tell me which step failed and why in two sentences, and fix the app side. If the fix needs a Terraform or workflow change, stop and tell me instead.
```

**Changing the seed data**
```text
Add <listing/user> to data/seed.json, add its image to data/seed-photos/ (or extend scripts/generate_seed_photos.py), update expectedResults, and run python3 scripts/check_seed.py until it prints "seed OK".
```

**Re-analyse a new survey export**
```text
Run python3 scripts/analyze_survey.py <new-export.csv>, compare it with docs/01-survey-insights.md, and update the numbers and the "Decisions for the build" table. Never copy emails or other personal data into the repo.
```
