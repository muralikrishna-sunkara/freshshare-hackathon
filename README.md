# FreshShare hackathon kit

**FreshShare:** free food from your neighbours, food you can trust. A map of shared food and community fridges within 2 km, built around the trust signals people asked for.

This repo holds everything needed to build the FreshShare MVP with Claude in one day, plus the pitch. The kit is grounded in the first survey export from **dev.freshshare.food** (17 responses, 2 to 6 Nov 2026).

## The survey in 30 seconds

- **15 of 17** bin their surplus food; leftovers, fruit/veg and bread; mostly because they **forgot** or it **expired**.
- **16 of 17** worry about **safety** when receiving food; **11** worry about **strangers**.
- **9** don't know where to share; **0** know a community fridge nearby; **12** use no food-saving app.
- Trust comes from **photos with dates (10)**, verified users (8), ratings (8), a homemade label (8).
- Most wanted features: **map (9)**, fridges (7), chat (7).

Full analysis: [docs/01-survey-insights.md](docs/01-survey-insights.md).

## What's in the kit

| File | Use it for |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Context Claude Code reads automatically in every session |
| [docs/01-survey-insights.md](docs/01-survey-insights.md) | Survey findings and the build decisions they drive |
| [docs/02-product-spec.md](docs/02-product-spec.md) | MVP scope (P0/P1/P2), acceptance criteria, screens, copy, product rules |
| [docs/03-architecture.md](docs/03-architecture.md) | Stack, repo layout, Prisma schema, API, AWS ECS deployment contract, security checklist |
| [docs/04-build-plan.md](docs/04-build-plan.md) | Tomorrow's hour-by-hour plan with a copy-paste Claude prompt per block |
| [pitch/PITCH.md](pitch/PITCH.md) | 3-minute script, slide outline, demo click path, Q&A prep, numbers cheat sheet |
| [data/seed.json](data/seed.json) | Fictional demo users, listings and fridges around Erlangen |
| [data/survey-anonymised.csv](data/survey-anonymised.csv) | Survey responses with emails and opt-in flags removed, postcodes truncated |
| [scripts/analyze_survey.py](scripts/analyze_survey.py) | Re-run the numbers on any new survey export |

## Start tomorrow

```bash
git clone https://github.com/muralikrishna-sunkara/freshshare-hackathon.git
cd freshshare-hackathon
git checkout -b build/mvp
claude            # then paste the Block 0 prompt from docs/04-build-plan.md
```

## Privacy

Survey respondents' contact details stay on the survey server. They are not in this repo, the seed data or the pitch.
