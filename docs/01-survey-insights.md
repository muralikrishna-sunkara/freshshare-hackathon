# Survey insights: what 17 neighbours told us

Source: survey export from **dev.freshshare.food**, 17 responses submitted 2 to 6 November 2026.
The anonymised data is in [`data/survey-anonymised.csv`](../data/survey-anonymised.csv) (emails and opt-in flags removed, postcodes cut to the first two digits). Re-run the numbers on any new export with:

```bash
python3 scripts/analyze_survey.py data/survey-anonymised.csv
```

All numbers below are **counts out of 17** unless stated. A blank answer counts as "did not choose".

## Who answered

| | |
|---|---|
| Role | 13 families, 3 households, 2 students (one person ticked two) |
| Age | 12 aged 35 to 49, 5 aged 25 to 34 |
| Household | 14 live in 3 to 4 person homes |
| Where | Mostly the Erlangen / Herzogenaurach area (PLZ 910xx and 913xx), plus Rostock and Hamburg |

**Read this as an early signal, not a market study.** It is a small, friendly sample, skewed to families in one region. It is great for choosing what to build first; it is not proof of demand.

## 1. The waste is real, small, and constant

- **15 of 17** throw food away at least monthly (2 weekly, 3 several times a week, 10 monthly).
- What gets wasted: **leftovers 13**, fruit and veg 11, bread 7, packaged 3, meat/fish 2, dairy 1.
- Value per week is small: 9 say under 10 EUR, 7 say 10 to 30 EUR, 1 says 30 to 60 EUR.
- Why: **forgot 12**, expired 8, away from home 6, bought too much 4.
- What happens to it today: **15 put it in the bin**, 7 freeze or cook it, 1 composts, 1 uses an app, 1 gives it to family/friends.

**So what:** this is not a "save money" story (the amounts are small). It is a "forgot / too late" story. The product has to make sharing **faster than binning**, and it should nudge people *before* food expires.

## 2. Two barriers block sharing: safety and "where?"

Barriers to giving food away (16 answered):

| Barrier | Count |
|---|---|
| Safety worries | **11** |
| Don't know where | **9** |
| Not worth it | 6 |
| Effort | 4 |
| Timing | 4 |
| Awkward | 4 |

12 of 17 name safety, "don't know where", or both. 11 have shared food "sometimes", 6 never.

Worries about *receiving* food (16 answered):

| Worry | Count |
|---|---|
| Safety | **16** (every person who answered) |
| Meeting strangers | **11** |
| Embarrassment | 6 |
| Time | 5 |
| Reliability | 2 |

**So what:** trust is the product. Every screen that shows food must answer "is it safe?" and "who is this?" before the user has to ask.

## 3. What builds trust (and it is cheap to build)

Trust builders (13 answered):

| Trust builder | Count |
|---|---|
| Photos with dates | **10** |
| Verified users | 8 |
| Ratings | 8 |
| "Homemade" label | 8 |
| Public meeting place | 2 |
| Allergen info | 1 |

**All 13** who answered picked photos/dates or verified users. Among the 9 "maybe" pickers (the people we most need to convert), **7 want photos with dates and 7 want a homemade label**.

**So what:** make *photo + best-before date + homemade/packaged label* mandatory on every listing, show a verified badge and a rating on every giver. These are hours of work, not weeks.

## 4. What people want to use

Useful features (14 answered): **map 9**, community fridges 7, chat 7, alerts 4, impact stats 4, autofill 2, recurring pickups 2.

- **0 of 17** know a community fridge near them (11 "don't know", 6 "none nearby").
- **12 of 17** use no food-saving app today, 3 use Too Good To Go, 1 local groups. The space is wide open for household-to-household sharing.
- Pickup distance (15 answered): 4 up to 500 m, 5 up to 1 km, 6 up to 2 km. **Default search radius: 2 km**, filter down to 500 m.
- Would pick up food: 3 yes, **9 maybe**, 5 no.
- Would volunteer: 1 yes, **14 maybe**, 2 no.
- Likely to use FreshShare (1 to 5, 16 answered): average **3.1**; 7 rate it 4 or 5.

In their own words:

> "Trust in the food shared and knowing that we are helping to save food."
>
> "Keep it simple."
>
> "Affordable and no time for cooking."

## Decisions for the build

| Finding | Build decision |
|---|---|
| Safety is the top worry (16) | Mandatory photo + best-before date + "homemade / packaged / fresh produce" label. Safety checklist when posting. |
| Strangers worry (11) | Verified badge (email + phone), ratings after each pickup, suggested public handover spot. |
| "Don't know where" (9), map is #1 feature (9) | Map-first home screen, 2 km default radius. |
| Nobody knows a fridge (0 of 17) | Community fridge layer on the same map, crowd-sourced "fridge was stocked" check-ins. |
| Chat wanted (7) | Simple per-listing chat to agree pickup time. |
| Forgot / expired (14) | "Expiring soon? Share it" reminder and alerts for new food nearby. |
| "Keep it simple" | Post a listing in under 30 seconds: photo, title, date, label, done. |
| Likely use 3.1/5, 9 "maybe" pickers | Pitch metric to move: convert "maybe" to "yes" with trust features, re-survey after demo. |

## Gaps to fill next

- No business or organisation responses yet (the `biz_*` and `org_needs` columns are empty). Bakeries and supermarkets are a separate segment to survey.
- 3 people opted into early access and 1 into an interview. Their contacts stay on the server; follow up directly, do not copy them into shared docs.
- Ask in the next survey: would you post homemade food at all, and what would make you do it this week?
