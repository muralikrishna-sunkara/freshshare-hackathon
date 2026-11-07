# Decisions log

- 2026-11-07: Seed keeps each user's `ratingAvg`/`ratingCount` from `seed.json` as their rating history (Anna stays 4.9 / 14 for the pitch); only users who start with 0 ratings (Sara) are recomputed from the seeded Rating rows.
- 2026-11-07: List endpoints filter on exact coordinates but return `publicLat`/`publicLng` and a distance rounded to 50 m, so homes can't be triangulated. `handoverSpot` is hidden until a claim is confirmed; lists only say `hasHandoverSpot`.
- 2026-11-07: Listings past `bestBefore` are excluded from the nearby query even before the background job marks them expired.
- 2026-11-07: `Fridge.photoUrl` added to the schema (seed has a photo per fridge).
- 2026-11-07: Web Caddy proxies `/api` and `/uploads` to `api:4000` locally; on ECS the ALB routes `/api/*` to the api directly and photos come from CloudFront.
- 2026-11-07: `npm run lint` is a strict TypeScript typecheck for both apps (fast, no extra config).
- 2026-11-07: Map uses the browser location only when it is within 30 km of the Erlangen demo centre; otherwise it shows the demo area (so judges elsewhere still see the seeded food) with a small "Showing the Erlangen demo area" note.
- 2026-11-07: `GET /api/fridges` added early (Block 2) so the empty map can say how many fridges are nearby; fridge pins show on the map. Check-ins and the fridge sheet stay in Block 9.
- 2026-11-07: Impact banner shows a static placeholder (18 portions, the seed baseline) until Block 10.
- 2026-11-07: Auth cookie `secure` follows the request scheme (`trust proxy` + ALB `X-Forwarded-Proto`), so sign-in also works on the plain-HTTP ALB URL before HTTPS is live.
- 2026-11-07: Homemade food is hidden from the map 48 h after posting (query filter) instead of clamping its best-before date, so the date shown stays the giver's real date.
- 2026-11-07: New accounts start unverified (no SMTP on the day); the DEMO phone step comes in Block 6.
- 2026-11-07: New ratings update the rated user's average incrementally (avg × count + stars) so seeded rating history is kept.
- 2026-11-07: Verified badge needs email + phone. Both steps are DEMO today: phone accepts code 123456, email is a one-tap confirm (no SMS or SMTP provider). Labelled DEMO in code and UI.
- 2026-11-07: The Playwright demo-path test (`npm run e2e`) runs locally or against `BASE_URL`; it is not wired into the deploy workflow yet because CI would need the full stack running (Block 7 follow-up).
- 2026-11-07: Impact "this week" = portions of claims collected in the last 7 days whose listing is within 2 km, plus the seeded `impactBaselinePortions` setting; kg = portions × 0.4, labelled as an estimate. Personal totals count portions given and received.
- 2026-11-07: Chat is allowed on pending, confirmed and collected pickups; closed (cancelled/lapsed) pickups are read-only.

## Desktop web layout (2026-11-07)
- Krish: "This is not a mobile application, it is a web app." From 1024 px the app uses a top nav (Find food, My pickups, Share food, profile), a 420 px sidebar with filters and the listing list next to the map, and listing/fridge details in a side panel over the map (Esc closes it). The pickup page puts the chat in a second column.
- Below 1024 px the same pages keep the Map/List toggle and bottom sheets, so phone browsers still work.
- Playwright runs the full demo path at 1440×900 (desktop) and a read-only browse check on an iPhone-sized browser.
- Hard-coded map/pin colours switched to the Basil & Honey palette (#2e5e4e / #1f4337 / #d9a23c / #7a560f) to match the theme PR; everything else uses Tailwind tokens.

## Kit BUILD_PLAN steps 1-10 (2026-11-07, thread "Complete BUILD_PLAN steps 1-10")
- Krish added a second kit (Next.js + Floci). We keep the live Vite/Express/Prisma stack on ECS and port its features.
- Landing page at `/` (signed-in users go to `/map`); the map moved to `/map`, `/about` always shows the landing page. Old `/?listing=<id>` links redirect to `/map?listing=<id>`.
- Sign-up requires 16+ and the Terms & Conditions (ticked only through "I Accept" in the dialog); the server stores `termsAcceptedAt` and `termsVersion` (2026-11-03, kit `docs/TERMS.md`).
- Early-access sign-ups upsert on lower-cased email and keep the first `?src=` seen.
- Landing stats are all-time totals from collected pickups plus the seeded baseline; accounts ending `@example.test` are excluded.
- Kit step 1b (SQS, SES, EventBridge on Floci) is skipped: those services aren't in our Terraform; the in-process job stays.
- Contact address on Imprint/Privacy/Contact is `hello@freshshare.de` (one constant in `apps/web/src/content/site.ts`).
- The SPA's 404 page renders client-side; Caddy still answers 200 for unknown paths.
- Listings take up to 4 photos (8 MB each, re-encoded to 1600 px WebP), dietary tags, an optional weight and description. `photoUrl` stays the first photo so older code keeps working.
- Public area label = Photon reverse geocode of the giver's home pin, keeping only `postcode` + district/city (`areaLabel`). Fails soft (no label) without network; off in tests.
- Map filters live in the URL (`km`, `category`, `diet`, `fridges`); radii are 1/2/5/10 km per the kit.
- Live chat uses Server-Sent Events that read new rows from Postgres every 1.5 s, so it works with several api tasks behind the ALB without a broker; polling is the fallback.
- Givers can decline a pending request (`declined`), which frees the listing. The losing reserve says "Someone else was quicker".
- "Post again" (on My pickups and on your own listing) copies fields and photos into the share form with fresh dates.
- Reports (listing or person, reason list from the kit plus harassment) go to an admin queue; repeats of an open report are ignored.
- Fridges get `kind`, description, access notes and a status. Suggestions are `pending` and 404 for everyone but the suggester and admins until approved. Check-ins record a fill level (empty/low/half/full) and what's inside; the older stocked/empty/needs_cleaning `state` is kept in step for the map.
- "Drop at a community fridge" puts the listing at that fridge's public location (no jitter, since it's a public place).
- Organizations: register → `pending`, creator becomes org admin. Directory and profile show approved orgs only (members and admins see their pending one). Verification documents (PDF/JPG/PNG ≤ 10 MB, file signature checked) are stored in Postgres, not S3, and streamed only to site admins and that org's admins.
- Org permissions go through `requireOrgRole`; anyone without the role gets 404 (so viewers don't see the bulk-claim form). The last admin can't be removed or demoted.
- Bulk claims reserve each picked listing with the same atomic available → reserved guard and create a normal pending claim per item, held until the listing's pickup window ends. Status: pending → in_progress (first item confirmed) → partially_completed → completed, or cancelled.
- Site admins: `User.role = admin` (seeded `admin@demo.freshshare.de`). `/api/admin/*` answers 403 to non-admins. `/admin` approves fridges and organizations.
- Admin reports queue: dismiss, or "remove listing", which sets the listing to `removed`, cancels any active reservation (and updates a bulk claim it belongs to) and resolves every open report on that listing. Early-access stats count all rows by role and source; the CSV export is admin-only, `no-store`, and prefixes cells starting with `= + - @` so spreadsheets don't run them.
- Seed photos are the kit's 25 Wikimedia Commons photos (credits on `/credits`, from `data/seed-photos/CREDITS.md`). Each is uploaded once per seed run as `seed/<name>.webp` and shared by every listing that uses it.
- The CLI / AWS seed also generates 8 weeks of fictional history (`services/seedHistory.ts`, fixed PRNG so every run is identical): ~32 more `@demo.freshshare.de` neighbours, ~105 collected or expired listings with chats and ratings, 12 available listings 2.6-9 km out, 6 more fridges with check-ins, 3 more approved organizations with past pickup runs, 64 early-access sign-ups and 4 open reports. It never adds available food within 2.2 km, so the pitch's 2 km map stays exactly the hand-written listings. API tests seed with `history: false`.
- `npm run db:clean-test` (or the "App database seed" workflow with `clean_test` ticked) deletes `@example.test` accounts and everything they created, without a full reset.
