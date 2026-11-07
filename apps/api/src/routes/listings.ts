import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { jitter } from "../lib/geo.js";
import { prisma } from "../lib/prisma.js";
import { postLimiter } from "../lib/rateLimit.js";
import { storage } from "../lib/storage.js";
import { photoUpload, toWebp } from "../lib/upload.js";
import { claimView, reserve } from "../services/claims.js";
import { findNearby, publicListing } from "../services/listings.js";
import { isRawMeatOrFish, RAW_MEAT_MESSAGE } from "../services/rules.js";

export const listings = Router();

const CATEGORIES = ["leftovers", "fruit_veg", "bread", "packaged", "dairy", "other"] as const;
const ORIGINS = ["homemade", "packaged", "fresh_produce"] as const;

const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(20000).default(2000),
  category: z.enum(CATEGORIES).optional(),
});

listings.get(
  "/",
  ah(async (req, res) => {
    const q = nearbyQuery.parse(req.query);
    res.json({ listings: await findNearby(q.lat, q.lng, q.radius, q.category) });
  }),
);

const ticked = z.literal("true", { errorMap: () => ({ message: "Please tick every item on the safety checklist" }) });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const createBody = z
  .object({
    title: z.string().trim().min(3, "Give it a short title").max(80),
    description: optionalText(500),
    category: z.enum(CATEGORIES),
    origin: z.enum(ORIGINS, { errorMap: () => ({ message: "Choose Homemade, Packaged or Fresh produce" }) }),
    bestBefore: z.coerce.date({ errorMap: () => ({ message: "Best-before date is required" }) }),
    pickupFrom: z.coerce.date().optional(),
    pickupUntil: z.coerce.date().optional(),
    portions: z.coerce.number().int().min(1).max(50).default(1),
    allergens: z
      .string()
      .optional()
      .transform((v) => (v ? [...new Set(v.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean))].slice(0, 14) : [])),
    handoverSpot: optionalText(120),
    storedCold: ticked,
    notPastDate: ticked,
    wouldEatIt: ticked,
  })
  .transform((b) => {
    const now = Date.now();
    const pickupFrom = b.pickupFrom ?? new Date(now);
    const pickupUntil = b.pickupUntil ?? new Date(pickupFrom.getTime() + 4 * 3600_000);
    return { ...b, pickupFrom, pickupUntil };
  });

listings.post(
  "/",
  requireAuth,
  postLimiter,
  photoUpload.single("photo"),
  ah(async (req, res) => {
    const giverId = userId(req);
    if (!req.file) throw new HttpError(400, "photo_required", "A photo is required so neighbours can see the food");
    const b = createBody.parse(req.body);
    if (b.bestBefore.getTime() <= Date.now()) throw new HttpError(400, "past_best_before", "The best-before date must be in the future");
    if (b.pickupUntil <= b.pickupFrom) throw new HttpError(400, "bad_pickup_window", "Pickup must end after it starts");
    if (isRawMeatOrFish(b.title, b.description)) throw new HttpError(400, "raw_meat_fish", RAW_MEAT_MESSAGE);

    const giver = await prisma.user.findUnique({ where: { id: giverId } });
    if (!giver) throw new HttpError(401, "unauthenticated", "Please sign in first");
    const photo = await toWebp(req.file.buffer);
    const pub = jitter(giver.homeLat, giver.homeLng);

    const created = await prisma.listing.create({
      data: {
        giverId, title: b.title, description: b.description, category: b.category, origin: b.origin, allergens: b.allergens,
        bestBefore: b.bestBefore, photoUrl: "", lat: giver.homeLat, lng: giver.homeLng, publicLat: pub.lat, publicLng: pub.lng,
        handoverSpot: b.handoverSpot, pickupFrom: b.pickupFrom, pickupUntil: b.pickupUntil, portions: b.portions,
      },
    });
    try {
      const photoUrl = await storage().put(`listings/${created.id}.webp`, photo, "image/webp");
      const l = await prisma.listing.update({ where: { id: created.id }, data: { photoUrl }, include: { giver: true } });
      res.status(201).json({ listing: { ...publicListing(l), lat: l.lat, lng: l.lng, handoverSpot: l.handoverSpot } });
    } catch (e) {
      await prisma.listing.delete({ where: { id: created.id } }).catch(() => {});
      throw e;
    }
  }),
);

listings.get(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const l = await prisma.listing.findUnique({
      where: { id },
      include: { giver: true, claims: { orderBy: { createdAt: "desc" }, select: { id: true, receiverId: true, status: true } } },
    });
    if (!l || l.status === "removed") throw new HttpError(404, "not_found", "Listing not found");
    const viewer = req.user?.id;
    const myClaim = viewer ? l.claims.find((c) => c.receiverId === viewer && c.status !== "cancelled" && c.status !== "lapsed") : undefined;
    const canSeeExact =
      !!viewer && (viewer === l.giverId || (!!myClaim && (myClaim.status === "confirmed" || myClaim.status === "collected")));
    res.json({
      listing: {
        ...publicListing(l),
        isMine: viewer === l.giverId,
        myClaim: myClaim ? { id: myClaim.id, status: myClaim.status } : null,
        ...(canSeeExact ? { lat: l.lat, lng: l.lng, handoverSpot: l.handoverSpot } : {}),
      },
    });
  }),
);

listings.post(
  "/:id/claims",
  requireAuth,
  ah(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const c = await reserve(id, userId(req));
    res.status(201).json({ claim: claimView(c, "receiver") });
  }),
);
