# Decisions log

- 2026-11-07: Seed keeps each user's `ratingAvg`/`ratingCount` from `seed.json` as their rating history (Anna stays 4.9 / 14 for the pitch); only users who start with 0 ratings (Sara) are recomputed from the seeded Rating rows.
- 2026-11-07: List endpoints filter on exact coordinates but return `publicLat`/`publicLng` and a distance rounded to 50 m, so homes can't be triangulated. `handoverSpot` is hidden until a claim is confirmed; lists only say `hasHandoverSpot`.
- 2026-11-07: Listings past `bestBefore` are excluded from the nearby query even before the background job marks them expired.
- 2026-11-07: `Fridge.photoUrl` added to the schema (seed has a photo per fridge).
- 2026-11-07: Web Caddy proxies `/api` and `/uploads` to `api:4000` locally; on ECS the ALB routes `/api/*` to the api directly and photos come from CloudFront.
- 2026-11-07: `npm run lint` is a strict TypeScript typecheck for both apps (fast, no extra config).
