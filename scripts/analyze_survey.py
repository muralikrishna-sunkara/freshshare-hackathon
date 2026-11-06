#!/usr/bin/env python3
"""Summarise a FreshShare survey export (CSV from dev.freshshare.food).

Usage:
    python3 scripts/analyze_survey.py data/survey-anonymised.csv
    python3 scripts/analyze_survey.py path/to/new-export.csv --markdown > docs/survey-latest.md

Counts are "of N respondents" (a blank answer counts as not choosing that option).
Multi-select answers are ';'-separated. Personal fields (email, interview opt-in)
are never printed.
"""
import argparse
import collections
import csv

SINGLE = ["role", "age", "household_size", "waste_freq", "waste_value", "shared_before",
          "would_pickup", "distance", "fridge_known", "volunteer", "likely_use"]
MULTI = ["waste_types", "waste_reasons", "surplus_now", "share_barriers", "receive_worries",
         "trust_builders", "apps_used", "useful_features"]
PRIVATE = {"email", "wants_interview", "wants_early_access"}


def tally(rows, col):
    c = collections.Counter()
    for r in rows:
        for v in (r.get(col) or "").split(";"):
            if v.strip():
                c[v.strip()] += 1
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--markdown", action="store_true")
    a = ap.parse_args()
    rows = list(csv.DictReader(open(a.csv, encoding="utf-8")))
    n = len(rows)
    dates = sorted(r["submitted_at"] for r in rows if r.get("submitted_at"))
    head = f"{n} responses" + (f", {dates[0][:10]} to {dates[-1][:10]}" if dates else "")
    print(f"# FreshShare survey summary\n\n{head}\n" if a.markdown else head)
    for col in SINGLE + MULTI:
        if col in PRIVATE or col not in rows[0]:
            continue
        c = tally(rows, col)
        if not c:
            continue
        if a.markdown:
            print(f"\n## {col}\n\n| answer | count | share |\n|---|---|---|")
            for k, v in c.most_common():
                print(f"| {k} | {v} | {v * 100 // n}% |")
        else:
            print(f"\n{col}: " + ", ".join(f"{k}={v}" for k, v in c.most_common()))
    scores = [int(r["likely_use"]) for r in rows if (r.get("likely_use") or "").isdigit()]
    if scores:
        line = f"likely_use average {sum(scores) / len(scores):.1f}/5, {sum(s >= 4 for s in scores)} of {len(scores)} rate 4-5"
        print(f"\n{line}" if not a.markdown else f"\n**{line}**")
    if "wants_early_access" in rows[0]:
        print(f"\nEarly-access opt-ins: {sum(r['wants_early_access'] == 'true' for r in rows)} (contacts stay on the server)")


if __name__ == "__main__":
    main()
