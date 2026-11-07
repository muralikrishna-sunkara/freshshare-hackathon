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
