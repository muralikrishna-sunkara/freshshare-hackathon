import { Router } from "express";
import { z } from "zod";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { findNearby, publicListing } from "../services/listings.js";

export const listings = Router();

const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(20000).default(2000),
  category: z.enum(["leftovers", "fruit_veg", "bread", "packaged", "dairy", "other"]).optional(),
});

listings.get(
  "/",
  ah(async (req, res) => {
    const q = nearbyQuery.parse(req.query);
    res.json({ listings: await findNearby(q.lat, q.lng, q.radius, q.category) });
  }),
);

listings.get(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const l = await prisma.listing.findUnique({
      where: { id },
      include: { giver: true, claims: { where: { status: { in: ["confirmed", "collected"] } }, select: { receiverId: true } } },
    });
    if (!l || l.status === "removed") throw new HttpError(404, "not_found", "Listing not found");
    const viewer = req.user?.id;
    const canSeeExact = !!viewer && (viewer === l.giverId || l.claims.some((c) => c.receiverId === viewer));
    res.json({
      listing: {
        ...publicListing(l),
        ...(canSeeExact ? { lat: l.lat, lng: l.lng, handoverSpot: l.handoverSpot } : {}),
      },
    });
  }),
);
