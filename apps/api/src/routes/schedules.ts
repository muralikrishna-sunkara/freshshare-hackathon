import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { isRawMeatOrFish, RAW_MEAT_MESSAGE } from "../services/rules.js";
import { nextRun } from "../services/schedules.js";

/** T2.4 recurring listings: "post this again every Mon/Wed/Fri at 17:00". */
export const schedules = Router();
schedules.use(requireAuth);

export const MAX_SCHEDULES = 10;
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 17:30");
const days = z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day").max(7).transform((d) => [...new Set(d)].sort());

const view = (s: Awaited<ReturnType<typeof prisma.listingSchedule.findFirstOrThrow>>) => ({
  id: s.id, title: s.title, category: s.category, origin: s.origin, portions: s.portions, photoUrl: s.photos[0] ?? null,
  daysOfWeek: s.daysOfWeek, time: s.time, pickupHours: s.pickupHours, bestBeforeDays: s.bestBeforeDays, active: s.active,
  lastPostedOn: s.lastPostedOn, nextRun: nextRun(s), createdAt: s.createdAt,
});

schedules.get(
  "/",
  ah(async (req, res) => {
    const rows = await prisma.listingSchedule.findMany({ where: { userId: userId(req) }, orderBy: { createdAt: "desc" } });
    res.json({ schedules: rows.map(view) });
  }),
);

const createBody = z.object({
  fromListingId: z.string().min(1).max(40),
  daysOfWeek: days,
  time: HHMM,
  pickupHours: z.number().int().min(1).max(12).default(3),
  bestBeforeDays: z.number().int().min(1).max(14).default(1),
});

/** Make one of your listings recurring: its text, details and photos become the template. */
schedules.post(
  "/",
  ah(async (req, res) => {
    const me = userId(req);
    const b = createBody.parse(req.body);
    const l = await prisma.listing.findUnique({ where: { id: b.fromListingId } });
    if (!l || l.giverId !== me) throw new HttpError(404, "not_found", "That listing wasn't found");
    if (isRawMeatOrFish(l.title, l.description)) throw new HttpError(400, "raw_meat_fish", RAW_MEAT_MESSAGE);
    if (l.origin === "homemade") throw new HttpError(400, "homemade_not_recurring", "Homemade food can't repeat automatically. Post it fresh each time.");
    if ((await prisma.listingSchedule.count({ where: { userId: me } })) >= MAX_SCHEDULES) throw new HttpError(409, "too_many", `You can have up to ${MAX_SCHEDULES} recurring listings`);
    const s = await prisma.listingSchedule.create({
      data: {
        userId: me, title: l.title, description: l.description, category: l.category, origin: l.origin, allergens: l.allergens,
        dietaryTags: l.dietaryTags, portions: l.portions, weightKg: l.weightKg, handoverSpot: l.handoverSpot, pickupInstructions: l.pickupInstructions,
        photos: l.photos.length ? l.photos : [l.photoUrl], daysOfWeek: b.daysOfWeek, time: b.time, pickupHours: b.pickupHours, bestBeforeDays: b.bestBeforeDays,
      },
    });
    res.status(201).json({ schedule: view(s) });
  }),
);

const patchBody = z.object({
  active: z.boolean().optional(),
  daysOfWeek: days.optional(),
  time: HHMM.optional(),
  pickupHours: z.number().int().min(1).max(12).optional(),
  portions: z.number().int().min(1).max(50).optional(),
});

async function mine(id: string, me: string) {
  const s = await prisma.listingSchedule.findUnique({ where: { id } });
  if (!s || s.userId !== me) throw new HttpError(404, "not_found", "Recurring listing not found");
  return s;
}

schedules.patch(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    await mine(id, userId(req));
    const s = await prisma.listingSchedule.update({ where: { id }, data: patchBody.parse(req.body) });
    res.json({ schedule: view(s) });
  }),
);

schedules.delete(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    await mine(id, userId(req));
    await prisma.listingSchedule.delete({ where: { id } });
    res.status(204).end();
  }),
);
