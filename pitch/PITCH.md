# FreshShare pitch

**Length:** 3 minutes + 2 minutes Q&A. **Format:** 7 slides + 60-second live demo.
**Tagline:** *Free food from your neighbours. Food you can trust.*

## The 3-minute script

### 1. Hook (0:00 to 0:20)
> "Last week we asked our neighbours in Erlangen one question: what happens to the food you don't eat? **15 out of 17 said the same thing: it goes in the bin.** Not because they don't care. Because they forgot, or it expired, and sharing it felt harder than throwing it away."

### 2. The problem, in their words (0:20 to 0:50)
> "We ran a survey on dev.freshshare.food. 15 of 17 waste food every month, mostly leftovers, fruit and veg, and bread. Most of them have shared food before. So why don't they share more?
> Two reasons. **Safety: 16 of 17 worry about whether shared food is safe to eat.** And **'I don't know where': nobody we asked knows a community fridge near them.** 12 of 17 use no food-saving app at all."

### 3. The insight (0:50 to 1:10)
> "So the problem isn't food. It's **trust and distance.** And the survey told us exactly what builds trust: **photos with dates, verified neighbours, ratings, and a clear 'homemade' label.** Every single person who answered picked photos or verified users."

### 4. The solution and live demo (1:10 to 2:10)
> "This is FreshShare. A map of free food within 2 km, built around trust."

Demo (see the click path below): map → lasagne card with photo, date, homemade label, verified badge, 4.9 stars → reserve → chat "on my way" → collected → 5 stars → impact counter ticks up → fridge layer.

> "Photo and date are required. The exact address only appears once the giver confirms. You can meet at a community fridge instead of a front door. Posting takes under 30 seconds, because the one comment we got most clearly was: **keep it simple.**"

### 5. Why now, why us (2:10 to 2:35)
> "Too Good To Go proved people will pick up surplus food, but it's for shops. Household sharing is still WhatsApp groups and guesswork. We built this today with Claude, from survey to deployed app at freshshare.de, on a stack we can run for a few euros a month."

### 6. Traction and next steps (2:35 to 2:50)
> "Day one: 17 responses, 9 'maybe I'd pick up food' and 3 people asking for early access. Our metric is simple: **turn the maybes into yeses.** Next: pilot in one Erlangen neighbourhood with two community fridges, then bakeries and food banks."

### 7. Close (2:50 to 3:00)
> "15 of 17 households bin food they would share if it felt safe and easy. FreshShare makes it both. Thank you."

## Slide outline

| # | Title | On screen |
|---|---|---|
| 1 | **FreshShare** | Logo, tagline "Free food from your neighbours. Food you can trust.", freshshare.de |
| 2 | **15 of 17 bin their surplus** | One big number. Sub-line: leftovers 13, fruit and veg 11, bread 7. Cause: forgot (12), expired (8). |
| 3 | **Two things stop them sharing** | Left: "Is it safe?" 16 of 17 worry. Right: "Where?" 0 of 17 know a community fridge nearby, 12 use no app. |
| 4 | **Trust is the product** | Bar chart of trust builders: photos+dates 10, verified 8, ratings 8, homemade label 8. Quote: "Trust in the food shared and knowing that we are helping to save food." |
| 5 | **FreshShare** (demo) | Phone screenshot of the map + listing card; switch to live demo. |
| 6 | **Built for the 9 maybes** | Feature → survey reason table: map (9 asked), fridges (7), chat (7), photo+date (10), verified+ratings (8). Stack strip: React, Leaflet, Express, Postgres, Docker, AWS ECS, GitHub Actions. |
| 7 | **Next: one neighbourhood, two fridges** | Pilot plan, metric "maybe → yes", early-access count 3, ask. |

## Demo click path (60 seconds)

Reseed first (deploy workflow with `seed=true`). Log in beforehand as **Sara** (`sara@demo.freshshare.de`) on your phone and **Anna** (`anna@demo.freshshare.de`) on the laptop; password `freshshare-demo`.

1. Phone: map opens on Erlangen, 2 km circle, 8 pins and 2 fridges. *"Here's what's free near me right now."*
2. Tap **Vegetable lasagne**: point at photo, "Best before tomorrow", **Homemade**, Anna, **Verified**, 4.9 stars, 450 m.
3. **Reserve.** Read the line: "You'll get the exact address once Anna confirms."
4. Laptop (Anna): confirm. Phone: address appears. Tap quick reply **"On my way"** (Tier 2; skip if chat isn't built).
5. Phone: **Mark collected** → 5 stars. Banner: "This week your neighbourhood saved 24 portions".
6. Toggle the fridge layer (Tier 2): "Demo Fridge: Parish Hall, checked 25 min ago: stocked."
7. Optional if time: tap **+ Share food** and show the 30-second form with the safety checklist.

**Backup:** a 60-second screen recording of exactly this path, on your laptop desktop.

## Q&A prep

**"Is sharing homemade food even legal / safe?"**
"We're conservative by design: no raw meat or fish, homemade food expires after 48 hours, a safety checklist on every post, photos and dates required, and a report button. Before a public launch we'll align with local food-sharing hygiene guidance, the way established food-sharing communities in Germany already do."

**"17 responses is tiny."**
"Agreed, it's an early signal from one region, not proof of demand. It was enough to decide what to build first, and the survey is still live, so every demo brings more data."

**"How is this different from Too Good To Go or foodsharing groups?"**
"Too Good To Go is shops selling surplus. Volunteer foodsharing groups are great but take effort to join. FreshShare is neighbour-to-neighbour, free, map-first, and puts the trust signals people asked for on every listing."

**"What stops no-shows or bad food?"**
"Thirty-minute holds that lapse automatically, two-way ratings, verified badges, and reports. Bad actors lose visibility fast."

**"How do you make money?"**
"Not the goal for the pilot. Later options: paid tools for bakeries and shops to post recurring surplus, and partnerships with cities that pay for waste reduction."

**"What did Claude actually do?"**
"Turned the survey into a spec, scaffolded the app, wrote the API, UI, tests, Docker and CI/CD with us reviewing every step. We made the product calls; Claude made us fast."

**"Privacy?"**
"Exact addresses are hidden until a confirmed reservation, photos are stripped of GPS data, and survey respondents' contact details never leave the survey server."

## Numbers cheat sheet (all out of 17 respondents)

| | |
|---|---|
| Bin surplus food | 15 |
| Waste at least monthly | 15 |
| Cause: forgot / expired | 12 / 8 |
| Worry about safety when receiving | 16 |
| Safety stops them giving | 11 |
| Don't know where to share | 9 |
| Worry about strangers | 11 |
| Know a community fridge nearby | 0 |
| Use no food-saving app | 12 |
| Want photos with dates | 10 |
| Want verified users / ratings / homemade label | 8 each |
| Want a map | 9 |
| Would pick up: yes / maybe / no | 3 / 9 / 5 |
| Likely to use (1 to 5) | 3.1 average |
| Early-access sign-ups | 3 |
