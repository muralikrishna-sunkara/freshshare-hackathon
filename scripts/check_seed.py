#!/usr/bin/env python3
"""Validate data/seed.json against the product rules and its own expectedResults.

Usage:  python3 scripts/check_seed.py        (exit code 1 on any problem)

Checks: unique keys, valid references, enum values, photos exist, no raw meat/fish,
homemade food expires within 48 h, demo-only email domain, and that the
2 km / 10 km search results computed here match expectedResults.
"""
import json
import math
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SEED = os.path.join(ROOT, "data", "seed.json")
PHOTOS = os.path.join(ROOT, "data", "seed-photos")

CATEGORIES = {"leftovers", "fruit_veg", "bread", "packaged", "dairy", "other"}
ORIGINS = {"homemade", "packaged", "fresh_produce"}
LISTING_STATUS = {"available", "reserved", "collected", "expired", "removed"}
CLAIM_STATUS = {"pending", "confirmed", "collected", "cancelled", "lapsed"}
FRIDGE_STATE = {"stocked", "empty", "needs_cleaning"}
BANNED_WORDS = ("raw meat", "raw fish", "chicken breast", "minced", "mince", "salmon fillet")

problems = []


def err(msg):
    problems.append(msg)


def dist_m(a_lat, a_lng, b_lat, b_lng):
    r = 6371000
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = p2 - p1, math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def main():
    seed = json.load(open(SEED, encoding="utf-8"))
    users = {u["key"]: u for u in seed["users"]}
    listings = {l["key"]: l for l in seed["listings"]}
    fridges = {f["key"]: f for f in seed["fridges"]}
    if len(users) != len(seed["users"]): err("duplicate user keys")
    if len(listings) != len(seed["listings"]): err("duplicate listing keys")

    emails = [u["email"] for u in seed["users"]]
    if len(set(emails)) != len(emails): err("duplicate user emails")
    for e in emails:
        if not e.endswith("@demo.freshshare.de"):
            err(f"user email {e} is not on the demo domain (never seed real people)")

    for k, l in listings.items():
        if l["giver"] not in users: err(f"{k}: unknown giver {l['giver']}")
        if l["category"] not in CATEGORIES: err(f"{k}: bad category {l['category']}")
        if l["origin"] not in ORIGINS: err(f"{k}: bad origin {l['origin']}")
        if l["status"] not in LISTING_STATUS: err(f"{k}: bad status {l['status']}")
        if not l.get("photo"): err(f"{k}: photo is required")
        elif not os.path.isfile(os.path.join(PHOTOS, l["photo"])): err(f"{k}: missing photo data/seed-photos/{l['photo']}")
        if any(w in l["title"].lower() for w in BANNED_WORDS): err(f"{k}: raw meat/fish is not allowed in the MVP")
        life = l["bestBeforeOffsetMin"] - l["createdOffsetMin"]
        if l["origin"] == "homemade" and life > 48 * 60: err(f"{k}: homemade food must expire within 48 h of posting")
        if l["status"] == "available" and l["bestBeforeOffsetMin"] <= 0: err(f"{k}: available but already past best-before")
        if l["status"] == "expired" and l["bestBeforeOffsetMin"] > 0: err(f"{k}: expired but best-before is in the future")
        if l["pickupUntilOffsetMin"] <= l["pickupFromOffsetMin"]: err(f"{k}: pickup window is empty")
        for ref in ("reservedBy", "collectedBy"):
            if ref in l and l[ref] not in users: err(f"{k}: unknown {ref} {l[ref]}")

    for c in seed.get("claims", []):
        if c["listing"] not in listings: err(f"claim: unknown listing {c['listing']}"); continue
        if c["receiver"] not in users: err(f"claim on {c['listing']}: unknown receiver")
        if c["status"] not in CLAIM_STATUS: err(f"claim on {c['listing']}: bad status")
        if c["receiver"] == listings[c["listing"]]["giver"]: err(f"claim on {c['listing']}: giver cannot claim own listing")
        for m in c.get("messages", []):
            if m["from"] not in users: err(f"message on {c['listing']}: unknown sender")
        for r in c.get("ratings", []):
            if not 1 <= r["stars"] <= 5: err(f"rating on {c['listing']}: stars must be 1-5")
            if r["from"] == r["to"]: err(f"rating on {c['listing']}: self-rating")
        if c.get("ratings") and c["status"] != "collected": err(f"claim on {c['listing']}: ratings only after collected")

    for k, f in fridges.items():
        if f.get("photo") and not os.path.isfile(os.path.join(PHOTOS, f["photo"])): err(f"fridge {k}: missing photo {f['photo']}")
        if f["lastCheckIn"]["state"] not in FRIDGE_STATE: err(f"fridge {k}: bad check-in state")

    # Recompute search results from the map centre and compare with expectedResults.
    c = seed["mapCentre"]
    exp = seed["expectedResults"]

    def within(radius):
        out = []
        for k, l in listings.items():
            g = users[l["giver"]]
            if l["status"] == "available" and dist_m(c["lat"], c["lng"], g["homeLat"], g["homeLng"]) <= radius:
                out.append(k)
        return sorted(out)

    for radius, key in ((2000, "availableWithin2km"), (10000, "availableWithin10km")):
        got = within(radius)
        if got != sorted(exp[key]): err(f"{key}: computed {got}, expected {sorted(exp[key])}")
    fr = sorted(k for k, f in fridges.items() if dist_m(c["lat"], c["lng"], f["lat"], f["lng"]) <= 2000)
    if fr != sorted(exp["fridgesWithin2km"]): err(f"fridgesWithin2km: computed {fr}")
    for k in exp["neverListed"]:
        if listings[k]["status"] == "available": err(f"{k} is in neverListed but available")
    for k in exp["verifiedGivers"]:
        if not (users[k]["emailVerified"] and users[k]["phoneVerified"]): err(f"{k} expected verified")
    for k in exp["unverifiedGivers"]:
        if users[k]["emailVerified"] and users[k]["phoneVerified"]: err(f"{k} expected unverified")

    unused = set(os.listdir(PHOTOS)) - {l["photo"] for l in listings.values()} - {f.get("photo") for f in fridges.values()}
    print(f"users {len(users)} · listings {len(listings)} · claims {len(seed.get('claims', []))} · fridges {len(fridges)} · photos {len(os.listdir(PHOTOS))}")
    print(f"within 2 km: {', '.join(within(2000))}")
    if unused: print(f"note: unused photos {sorted(unused)}")
    if problems:
        print("\nPROBLEMS:\n- " + "\n- ".join(problems))
        sys.exit(1)
    print("seed OK")


if __name__ == "__main__":
    main()
