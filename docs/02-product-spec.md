# Product spec: FreshShare MVP (hackathon scope)

**One line:** FreshShare is a map of free food from your neighbours and community fridges within 2 km, built so you can trust what you pick up.

**Who it is for (from the survey):** families and small households who bin leftovers, fruit/veg and bread every month because they forgot or ran out of time, and who would share if they knew where and felt it was safe.

**What success looks like at the demo:** a giver posts a homemade dish with photo, date and label in under 30 seconds; a neighbour sees it on the map, checks the giver's verified badge and rating, reserves it, agrees a time in chat, collects it, and rates the handover. Then both see the fridge layer and an impact counter.

## Scope

### P0: must ship (the demo breaks without these)

| # | Feature | Why (survey) | Acceptance criteria |
|---|---|---|---|
| 1 | **Map-first home** | Map is the #1 feature (9); "don't know where" is barrier #2 (9) | Opens on the user's location (or Erlangen centre as fallback). Shows available listings within **2 km**; radius filter 500 m / 1 km / 2 km. Pins coloured by category. List view toggle. |
| 2 | **Trust-first listing card** | Safety is the #1 worry (16); photos+dates the #1 trust builder (10) | Every listing shows: photo, title, **best-before / made-on date**, **label: homemade / packaged / fresh produce**, allergens (optional), giver name, **verified badge**, **star rating**, distance, "posted X min ago". |
| 3 | **Post a listing in 30 seconds** | "Keep it simple" | Steps: photo (camera or upload) → title → category → label → date → pickup window → 3-item safety checklist ("stored cold", "not past date", "I would eat it myself") → post. Photo and date are required. Location defaults to the user's home location. |
| 4 | **Reserve and pick up** | Reliability, timing | "Reserve" puts a 30-minute hold on the listing. Giver confirms. Exact address shown only after confirmation (before that, a pin jittered by ~150 m). Status flow: available → reserved → collected (or back to available if the hold lapses). |
| 5 | **Per-listing chat** | Chat wanted (7), strangers worry (11) | Simple text chat between giver and the person who reserved. Polling every 3 s is fine for the MVP. Suggested quick replies: "On my way", "Can we meet at the bakery on the corner?" |
| 6 | **Ratings + verified badge** | Verified (8), ratings (8) | After "collected", both sides rate 1 to 5 stars with an optional note. Profile shows average + count. "Verified" badge = email confirmed + phone confirmed (phone can be a seeded flag for the demo; say so if asked). |
| 7 | **Sign up / sign in** | Prerequisite | Email + password, name, home location (pick on map). |

### P1: should ship (these win the pitch)

| # | Feature | Why | Acceptance criteria |
|---|---|---|---|
| 8 | **Community fridge layer** | 0 of 17 know a fridge nearby; fridges wanted (7) | Fridges appear on the same map with a distinct icon. Detail: address, opening hours, last check-in. "I just checked it" button with status: stocked / empty / needs cleaning. |
| 9 | **Public handover spots** | Strangers worry (11) | Giver can pick a suggested public spot (fridge, bakery, station) instead of the front door. |
| 10 | **Nearby alerts** | Alerts (4), forgot/expired (14) | User subscribes to categories within a radius. In-app notification list for new matching listings. (Web push or email is P2.) |
| 11 | **Impact counter** | Impact (4), "knowing we are helping" | Home header: "This week your neighbourhood saved 23 portions (about 9 kg)". Profile: personal total. Use 0.4 kg per portion as an estimate and label it as one. |

### P2: stretch (only if P0 and P1 are solid)

- "Expiring soon? Share it" reminder: user logs a fridge item with a date, gets nudged the day before.
- Photo autofill: suggest title and category from the photo with the Claude API.
- Recurring pickups (a bakery that has bread every evening).
- Web push notifications, German translation (all respondents answered in English, but the users are in Germany).
- Business accounts (no business responses yet, so keep this out of the demo).

### Out of scope for tomorrow

Payments, delivery, native mobile apps (build a responsive PWA instead), moderation tooling beyond a "report listing" button that writes to the database.

## Product rules (conservative defaults)

- No raw meat or fish listings in the MVP. Cooked dishes must be labelled homemade and dated.
- Listings auto-expire at the best-before date or after 48 hours for homemade food, whichever is first.
- Exact address is hidden until a reservation is confirmed.
- Every listing has a "Report" button.
- These are product choices to reduce risk, not legal advice. Check local food-sharing hygiene guidance before a public launch.

## Screens

1. **Map home**: map, radius chips, category chips, impact banner, "+ Share food" button, list/map toggle.
2. **Listing detail**: big photo, date and label chips, giver card (badge, stars), distance, pickup window, Reserve button, Report link.
3. **Post listing**: one scrolling form with the safety checklist at the bottom.
4. **Chat**: thread per reservation with quick replies and "Mark collected".
5. **Rate**: stars + optional note.
6. **Fridge detail**: hours, last check-in, check-in buttons.
7. **Profile**: name, badge, rating, items shared/received, kg saved, alert settings.
8. **Sign up / sign in**.

## Copy that answers the survey's worries

- On every card: "Photo taken today · Best before 8 Nov · Homemade".
- Under the Reserve button: "You'll get the exact address once Anna confirms. Meet in a public place if you prefer."
- Post form header: "Share in 30 seconds. Photo and date help neighbours trust your food."
- Empty map: "Nothing within 2 km yet. There are 2 community fridges nearby." (never a dead end)

## Demo data

Seed with realistic but fictional people and listings around Erlangen (see [`data/seed.json`](../data/seed.json)). Fridges in the seed file are placeholders with made-up names; replace them with real Fairteiler locations only after checking a current source.
