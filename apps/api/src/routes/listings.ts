import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { jitter } from "../lib/geo.js";
import { prisma } from "../lib/prisma.js";
import { notifyNearby } from "../services/notify.js";
import { postLimiter } from "../lib/rateLimit.js";
import { storage } from "../lib/storage.js";
import { reverseArea } from "../lib/geocode.js";
import { MAX_PHOTOS, photoUpload, toWebp } from "../lib/upload.js";
import { claimView, reserve } from "../services/claims.js";
import { findNearby, publicListing } from "../services/listings.js";
import { DIETARY_TAGS, isRawMeatOrFish, RAW_MEAT_MESSAGE } from "../services/rules.js";

export const listings = Router();

const CATEGORIES = ["leftovers", "fruit_veg", "bread", "packaged", "dairy", "other"] as const;
const ORIGINS = ["homemade", "packaged", "fresh_produce"] as const;

const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(20000).default(2000),
  category: z.enum(CATEGORIES).optional(),
  diet: z.enum(DIETARY_TAGS).optional(),
});

listings.get(
  "/",
  ah(async (req, res) => {
    const q = nearbyQuery.parse(req.query);
    res.json({ listings: await findNearby(q.lat, q.lng, q.radius, q.category, q.diet) });
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
    dietaryTags: z
      .string()
      .optional()
      .transform((v) => (v ? [...new Set(v.split(",").map((a) => a.trim()).filter(Boolean))] : []))
      .pipe(z.array(z.enum(DIETARY_TAGS, { errorMap: () => ({ message: "Unknown dietary tag" }) }))),
    weightKg: z.coerce.number().min(0.05).max(50).optional(),
    handoverSpot: optionalText(120),
    // "Post again": reuse the photos of one of your own earlier listings when no new photo is attached.
    fromListingId: z.string().min(1).max(40).optional(),
    // "Drop at a community fridge": the listing's place is that (public) fridge instead of the giver's home.
    fridgeId: z.string().min(1).max(40).optional(),
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

const photoFields = photoUpload.fields([
  { name: "photo", maxCount: 1 },
  { name: "photos", maxCount: MAX_PHOTOS },
]);

listings.post(
  "/",
  requireAuth,
  postLimiter,
  photoFields,
  ah(async (req, res) => {
    const giverId = userId(req);
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const uploads = [...(files?.photo ?? []), ...(files?.photos ?? [])];
    if (uploads.length > MAX_PHOTOS) throw new HttpError(400, "too_many_photos", "You can add up to 4 photos");
    const b = createBody.parse(req.body);
    if (b.bestBefore.getTime() <= Date.now()) throw new HttpError(400, "past_best_before", "The best-before date must be in the future");
    if (b.pickupUntil <= b.pickupFrom) throw new HttpError(400, "bad_pickup_window", "Pickup must end after it starts");
    if (isRawMeatOrFish(b.title, b.description)) throw new HttpError(400, "raw_meat_fish", RAW_MEAT_MESSAGE);

    let reusedPhotos: string[] = [];
    if (uploads.length === 0 && b.fromListingId) {
      const src = await prisma.listing.findUnique({ where: { id: b.fromListingId } });
      if (!src || src.giverId !== giverId) throw new HttpError(404, "not_found", "That earlier listing wasn't found");
      reusedPhotos = src.photos.length ? src.photos : [src.photoUrl];
    }
    if (uploads.length === 0 && reusedPhotos.length === 0) {
      throw new HttpError(400, "photo_required", "A photo is required so neighbours can see the food");
    }

    const giver = await prisma.user.findUnique({ where: { id: giverId } });
    if (!giver) throw new HttpError(401, "unauthenticated", "Please sign in first");
    let fridge = null;
    if (b.fridgeId) {
      fridge = await prisma.fridge.findUnique({ where: { id: b.fridgeId } });
      if (!fridge || fridge.status !== "active") throw new HttpError(400, "bad_fridge", "Please pick an approved community fridge");
    }
    const encoded = await Promise.all(uploads.map((f) => toWebp(f.buffer)));
    const place = fridge ? { lat: fridge.lat, lng: fridge.lng } : { lat: giver.homeLat, lng: giver.homeLng };
    const pub = fridge ? place : jitter(place.lat, place.lng);
    const area = await reverseArea(place.lat, place.lng);

    const created = await prisma.listing.create({
      data: {
        giverId, title: b.title, description: b.description, category: b.category, origin: b.origin, allergens: b.allergens,
        dietaryTags: b.dietaryTags, weightKg: b.weightKg ?? null, postcode: area.postcode, areaName: area.areaName,
        bestBefore: b.bestBefore, photoUrl: reusedPhotos[0] ?? "", photos: reusedPhotos, lat: place.lat, lng: place.lng, fridgeId: fridge?.id ?? null,
        publicLat: pub.lat, publicLng: pub.lng, handoverSpot: b.handoverSpot, pickupFrom: b.pickupFrom, pickupUntil: b.pickupUntil,
        portions: b.portions,
      },
    });
    try {
      let l;
      if (encoded.length) {
        const photos = await Promise.all(
          encoded.map((buf, i) => storage().put(`listings/${created.id}${i === 0 ? "" : `-${i}`}.webp`, buf, "image/webp")),
        );
        l = await prisma.listing.update({ where: { id: created.id }, data: { photoUrl: photos[0], photos }, include: { giver: true, fridge: true } });
      } else {
        l = await prisma.listing.findUniqueOrThrow({ where: { id: created.id }, include: { giver: true, fridge: true } });
      }
      res.status(201).json({ listing: { ...publicListing(l), lat: l.lat, lng: l.lng, handoverSpot: l.handoverSpot } });
      void notifyNearby(l);
    } catch (e) {
      await prisma.listing.delete({ where: { id: created.id } }).catch(() => {});
      throw e;
    }
  }),
);

/** My own listings (for "Post again" and the giver's overview). */
listings.get(
  "/mine/all",
  requireAuth,
  ah(async (req, res) => {
    const rows = await prisma.listing.findMany({
      where: { giverId: userId(req), status: { not: "removed" } },
      include: { giver: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ listings: rows.map((l) => ({ ...publicListing(l), handoverSpot: l.handoverSpot })) });
  }),
);

listings.get(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const l = await prisma.listing.findUnique({
      where: { id },
      include: { giver: true, fridge: true, claims: { orderBy: { createdAt: "desc" }, select: { id: true, receiverId: true, status: true } } },
    });
    if (!l || l.status === "removed") throw new HttpError(404, "not_found", "Listing not found");
    const viewer = req.user?.id;
    const myClaim = viewer
      ? l.claims.find((c) => c.receiverId === viewer && c.status !== "cancelled" && c.status !== "lapsed" && c.status !== "declined")
      : undefined;
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
