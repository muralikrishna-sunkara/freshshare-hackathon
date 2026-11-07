import { Router } from "express";
import { z } from "zod";
import { isAdmin, requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { renderImpactCard } from "../lib/impactCard.js";
import { distanceM } from "../lib/geo.js";
import { prisma } from "../lib/prisma.js";
import { CO2E_PER_KG, factors, KG_PER_PORTION, orgImpact, userImpact } from "../services/impact.js";
import { renderOrgReport } from "../services/impactReport.js";
import { requireOrgRole } from "../services/orgs.js";
import { TEST_EMAIL_SUFFIX } from "../services/rules.js";

export const impact = Router();

export { CO2E_PER_KG, KG_PER_PORTION };
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

// ---------- Personal and organization impact (T3.2) ----------

const idParam = z.string().min(1).max(40);
const monthYear = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

async function userOr404(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!u) throw new HttpError(404, "not_found", "Person not found");
}

/** Anyone's impact (aggregates only, like the public profile): meals, kg, CO2e and water, given and received. */
impact.get(
  "/users/:id",
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    await userOr404(id);
    res.json({ ...(await userImpact(id)), factors, estimate: true });
  }),
);

/** Shareable 1200x630 PNG for a person (also used as the Open Graph image). */
impact.get(
  "/users/:id/card.png",
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    await userOr404(id);
    const i = await userImpact(id);
    const png = await renderImpactCard({
      headline: "Sharing food with neighbours on FreshShare",
      name: i.user.name,
      meals: i.total.meals,
      kg: i.total.kg,
      co2Kg: i.total.co2Kg,
      waterL: i.total.waterL,
      footnote: `Member since ${monthYear(i.user.memberSince)}`,
    });
    res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=600" }).send(png);
  }),
);

/** Organizations: approved ones are public; a pending one only to its members and site admins. */
async function visibleOrg(id: string, viewer: string | undefined) {
  const org = await prisma.organization.findUnique({ where: { id }, select: { status: true } });
  if (!org) throw new HttpError(404, "not_found", "Organization not found");
  if (org.status === "approved" || (await isAdmin(viewer))) return;
  await requireOrgRole(id, viewer);
}

impact.get(
  "/organizations/:id",
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    await visibleOrg(id, req.user?.id);
    res.json({ ...(await orgImpact(id)), factors, estimate: true });
  }),
);

impact.get(
  "/organizations/:id/card.png",
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    await visibleOrg(id, req.user?.id);
    const i = await orgImpact(id);
    const png = await renderImpactCard({
      headline: "Rescuing food with FreshShare",
      name: i.organization.name,
      meals: i.total.meals,
      kg: i.total.kg,
      co2Kg: i.total.co2Kg,
      waterL: i.total.waterL,
      footnote: `${i.pickupRuns} pickup runs`,
    });
    res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=600" }).send(png);
  }),
);

/** One-page PDF report for funders and boards. Members of the organization (any role) and site admins. */
impact.get(
  "/organizations/:id/report.pdf",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const me = userId(req);
    if (!(await isAdmin(me))) await requireOrgRole(id, me);
    const data = await orgImpact(id);
    const pdf = await renderOrgReport(data);
    const slug = data.organization.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "organization";
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="freshshare-impact-${slug}.pdf"`,
      "Cache-Control": "no-store",
    }).send(pdf);
  }),
);
