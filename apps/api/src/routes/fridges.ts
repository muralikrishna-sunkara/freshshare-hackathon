import { Router } from "express";
import { z } from "zod";
import { isAdmin, requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { distanceM, roundDistance } from "../lib/geo.js";
import { prisma } from "../lib/prisma.js";
import { publicListing } from "../services/listings.js";

export const fridges = Router();

const q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(50000).default(2000),
});

type FridgeRow = Awaited<ReturnType<typeof prisma.fridge.findMany<{ include: { checkIns: true } }>>>[number];
const lastCheckIn = (f: FridgeRow) =>
  f.checkIns[0] ? { state: f.checkIns[0].state, fillLevel: f.checkIns[0].fillLevel, at: f.checkIns[0].createdAt } : null;

/** Approved (active) fridges only. Fridge addresses are public places, so exact coordinates are fine. */
fridges.get(
  "/",
  ah(async (req, res) => {
    const { lat, lng, radius } = q.parse(req.query);
    const rows = await prisma.fridge.findMany({ where: { status: "active" }, include: { checkIns: { orderBy: { createdAt: "desc" }, take: 1 } } });
    const out = rows
      .map((f) => ({ f, d: distanceM(lat, lng, f.lat, f.lng) }))
      .filter((x) => x.d <= radius)
      .sort((a, b) => a.d - b.d)
      .map(({ f, d }) => ({
        id: f.id,
        name: f.name,
        kind: f.kind,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        openingHours: f.openingHours,
        photoUrl: f.photoUrl,
        distanceM: roundDistance(d),
        lastCheckIn: lastCheckIn(f),
      }));
    res.json({ fridges: out });
  }),
);

const suggestBody = z.object({
  name: z.string().trim().min(3, "Give the fridge a name").max(80),
  kind: z.enum(["fridge", "pantry", "dropoff"]),
  description: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
  address: z.string().trim().min(5, "Please enter the address").max(160),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  openingHours: z.string().trim().min(2, "Please add opening hours").max(120),
  accessNotes: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
});

/** Suggest a fridge: saved as pending until an admin approves it. */
fridges.post(
  "/",
  requireAuth,
  ah(async (req, res) => {
    const b = suggestBody.parse(req.body);
    const f = await prisma.fridge.create({ data: { ...b, status: "pending", createdById: userId(req) } });
    res.status(201).json({ fridge: { id: f.id, status: f.status }, message: "Thanks! We'll check it and put it on the map." });
  }),
);

/** Fridge detail. Pending/rejected fridges are 404 for everyone except the person who suggested it and admins. */
fridges.get(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const f = await prisma.fridge.findUnique({
      where: { id },
      include: {
        checkIns: { orderBy: { createdAt: "desc" }, take: 20 },
        listings: { where: { status: "available", bestBefore: { gt: new Date() } }, include: { giver: true }, take: 20 },
      },
    });
    const viewer = req.user?.id;
    if (!f || (f.status !== "active" && f.createdById !== viewer && !(await isAdmin(viewer)))) {
      throw new HttpError(404, "not_found", "Fridge not found");
    }
    const people = await prisma.user.findMany({ where: { id: { in: [...new Set(f.checkIns.map((c) => c.userId))] } }, select: { id: true, name: true } });
    const nameOf = new Map(people.map((p) => [p.id, p.name]));
    res.json({
      fridge: {
        id: f.id,
        name: f.name,
        kind: f.kind,
        description: f.description,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        openingHours: f.openingHours,
        accessNotes: f.accessNotes,
        photoUrl: f.photoUrl,
        status: f.status,
        checkIns: f.checkIns.map((c) => ({
          id: c.id,
          state: c.state,
          fillLevel: c.fillLevel,
          contents: c.contents,
          at: c.createdAt,
          by: { id: c.userId, name: nameOf.get(c.userId) ?? "A neighbour" },
        })),
        listings: f.listings.map((l) => publicListing(l)),
      },
    });
  }),
);

const checkInBody = z
  .object({
    state: z.enum(["stocked", "empty", "needs_cleaning"]).optional(),
    fillLevel: z.enum(["empty", "low", "half", "full"]).optional(),
    contents: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
  })
  .refine((b) => b.state || b.fillLevel, { message: "Tell us how full it is" });

fridges.post(
  "/:id/checkins",
  requireAuth,
  ah(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const b = checkInBody.parse(req.body);
    const fridge = await prisma.fridge.findUnique({ where: { id } });
    if (!fridge || fridge.status !== "active") throw new HttpError(404, "not_found", "Fridge not found");
    // Older clients send `state`; the fridge page sends a fill level (+ contents). Keep both in step.
    const state = b.state ?? (b.fillLevel === "empty" ? "empty" : "stocked");
    const c = await prisma.fridgeCheckIn.create({
      data: { fridgeId: id, userId: userId(req), state, fillLevel: b.fillLevel ?? null, contents: b.contents ?? null },
    });
    res.status(201).json({ checkIn: { state: c.state, fillLevel: c.fillLevel, contents: c.contents, at: c.createdAt }, message: "Thanks! Neighbours will see this." });
  }),
);
