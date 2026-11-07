import { Router } from "express";
import { z } from "zod";
import { ah } from "../lib/errors.js";
import { distanceM } from "../lib/geo.js";
import { prisma } from "../lib/prisma.js";
import { TEST_EMAIL_SUFFIX } from "../services/rules.js";

export const impact = Router();

export const KG_PER_PORTION = 0.4; // estimate, labelled as such in the UI
export const CO2E_PER_KG = 2.5; // kg CO2e avoided per kg of food not wasted (kit PRODUCT.md)
const WEEK_MS = 7 * 24 * 3600 * 1000;
const kg = (portions: number) => Math.round(portions * KG_PER_PORTION * 10) / 10;

const q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(20000).default(2000),
});

impact.get(
  "/",
  ah(async (req, res) => {
    const { lat, lng, radius } = q.parse(req.query);
    const since = new Date(Date.now() - WEEK_MS);
    const [recent, baselineRow] = await Promise.all([
      prisma.claim.findMany({
        where: { status: "collected", createdAt: { gte: since } },
        select: { listing: { select: { portions: true, lat: true, lng: true } } },
      }),
      prisma.setting.findUnique({ where: { key: "impactBaselinePortions" } }),
    ]);
    const nearby = recent.filter((c) => distanceM(lat, lng, c.listing.lat, c.listing.lng) <= radius).reduce((n, c) => n + c.listing.portions, 0);
    const portions = nearby + Number(baselineRow?.value ?? 0);

    let me = null;
    if (req.user) {
      const mine = await prisma.claim.findMany({
        where: { status: "collected", OR: [{ receiverId: req.user.id }, { listing: { giverId: req.user.id } }] },
        select: { receiverId: true, listing: { select: { portions: true } } },
      });
      const received = mine.filter((c) => c.receiverId === req.user!.id).reduce((n, c) => n + c.listing.portions, 0);
      const given = mine.filter((c) => c.receiverId !== req.user!.id).reduce((n, c) => n + c.listing.portions, 0);
      me = { portionsGiven: given, portionsReceived: received, kg: kg(given + received) };
    }
    res.json({ week: { portions, kg: kg(portions) }, me, kgPerPortion: KG_PER_PORTION, estimate: true });
  }),
);

/** All-time totals for the landing page stats bar. Counted from collected pickups; test accounts are left out. */
impact.get(
  "/totals",
  ah(async (_req, res) => {
    const notTest = { email: { not: { endsWith: TEST_EMAIL_SUFFIX } } };
    const [collected, neighbours, fridges, organizations] = await Promise.all([
      prisma.claim.findMany({
        where: { status: "collected", receiver: notTest, listing: { giver: notTest } },
        select: { listing: { select: { portions: true } } },
      }),
      prisma.user.count({ where: notTest }),
      prisma.fridge.count({ where: { status: "active" } }),
      prisma.organization.count({ where: { status: "approved" } }),
    ]);
    const meals = collected.reduce((n, c) => n + c.listing.portions, 0);
    const baselineRow = await prisma.setting.findUnique({ where: { key: "impactBaselinePortions" } });
    const totalMeals = meals + Number(baselineRow?.value ?? 0);
    const kgSaved = kg(totalMeals);
    res.json({
      meals: totalMeals,
      kgSaved,
      co2Kg: Math.round(kgSaved * CO2E_PER_KG),
      neighbours,
      fridges,
      organizations,
      estimate: true,
    });
  }),
);
