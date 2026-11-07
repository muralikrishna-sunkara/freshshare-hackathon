import { prisma } from "../lib/prisma.js";

/** Estimates, shown as such in the UI and the report. */
export const KG_PER_PORTION = 0.4; // when the giver didn't enter a weight
export const CO2E_PER_KG = 2.5; // kg CO2e avoided per kg of food not wasted (kit PRODUCT.md)
export const WATER_L_PER_KG = 190; // litres of blue water per kg of food (FAO, Food Wastage Footprint 2013: ~250 km3 for 1.3 bn t)

export interface Totals {
  meals: number;
  kg: number;
  co2Kg: number;
  waterL: number;
  pickups: number;
}

type Row = { createdAt: Date; listing: { portions: number; weightKg: number | null; category: string; giverId: string } };

const round1 = (n: number) => Math.round(n * 10) / 10;
const kgOf = (r: Row) => r.listing.weightKg ?? r.listing.portions * KG_PER_PORTION;

export function totals(rows: Row[]): Totals {
  const kg = rows.reduce((n, r) => n + kgOf(r), 0);
  return {
    meals: rows.reduce((n, r) => n + r.listing.portions, 0),
    kg: round1(kg),
    co2Kg: round1(kg * CO2E_PER_KG),
    waterL: Math.round(kg * WATER_L_PER_KG),
    pickups: rows.length,
  };
}

/** Meals and kg per calendar month (Europe/Berlin), oldest first, including empty months. */
export function monthly(rows: Row[], months: number, now = new Date()) {
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).slice(0, 7);
  const out: { month: string; label: string; meals: number; kg: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    out.push({ month: key(d), label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }), meals: 0, kg: 0 });
  }
  const byKey = new Map(out.map((m) => [m.month, m]));
  for (const r of rows) {
    const m = byKey.get(key(r.createdAt));
    if (m) {
      m.meals += r.listing.portions;
      m.kg = round1(m.kg + kgOf(r));
    }
  }
  return out;
}

const select = { createdAt: true, listing: { select: { portions: true, weightKg: true, category: true, giverId: true } } } as const;

/** A person's impact: food they gave away (collected) and food they rescued, plus their community activity. */
export async function userImpact(userId: string) {
  const [given, received, user, listed, checkIns] = await Promise.all([
    prisma.claim.findMany({ where: { status: "collected", listing: { giverId: userId } }, select }),
    prisma.claim.findMany({ where: { status: "collected", receiverId: userId }, select }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, createdAt: true } }),
    prisma.listing.count({ where: { giverId: userId, status: { not: "removed" } } }),
    prisma.fridgeCheckIn.count({ where: { userId } }),
  ]);
  const all = [...given, ...received];
  return {
    user: { id: user.id, name: user.name, memberSince: user.createdAt },
    total: totals(all),
    given: totals(given),
    received: totals(received),
    listingsShared: listed,
    fridgeCheckIns: checkIns,
    monthly: monthly(given.concat(received), 6),
  };
}

/** An organization's impact: everything its members collected on its behalf (bulk claims and org pickups). */
export async function orgImpact(organizationId: string) {
  const [org, rows, runs] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { id: true, name: true, type: true, city: true, status: true, verifiedAt: true, createdAt: true } }),
    prisma.claim.findMany({ where: { status: "collected", organizationId }, select }),
    prisma.bulkClaim.count({ where: { organizationId, status: { in: ["completed", "partially_completed"] } } }),
  ]);
  const yearAgo = new Date(Date.now() - 365 * 24 * 3600_000);
  const byCategory = new Map<string, number>();
  for (const r of rows) byCategory.set(r.listing.category, (byCategory.get(r.listing.category) ?? 0) + r.listing.portions);
  return {
    organization: org,
    total: totals(rows),
    last12Months: totals(rows.filter((r) => r.createdAt >= yearAgo)),
    pickupRuns: runs,
    giversHelped: new Set(rows.map((r) => r.listing.giverId)).size,
    categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([category, meals]) => ({ category, meals })),
    monthly: monthly(rows, 12),
  };
}

export const factors = { kgPerPortion: KG_PER_PORTION, co2ePerKg: CO2E_PER_KG, waterLitresPerKg: WATER_L_PER_KG };
