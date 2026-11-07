import { Router } from "express";
import { z } from "zod";
import { ah } from "../lib/errors.js";
import { distanceM, roundDistance } from "../lib/geo.js";
import { prisma } from "../lib/prisma.js";

export const fridges = Router();

const q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(20000).default(2000),
});

fridges.get(
  "/",
  ah(async (req, res) => {
    const { lat, lng, radius } = q.parse(req.query);
    const rows = await prisma.fridge.findMany({ include: { checkIns: { orderBy: { createdAt: "desc" }, take: 1 } } });
    const out = rows
      .map((f) => ({ f, d: distanceM(lat, lng, f.lat, f.lng) }))
      .filter((x) => x.d <= radius)
      .sort((a, b) => a.d - b.d)
      .map(({ f, d }) => ({
        id: f.id,
        name: f.name,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        openingHours: f.openingHours,
        photoUrl: f.photoUrl,
        distanceM: roundDistance(d),
        lastCheckIn: f.checkIns[0] ? { state: f.checkIns[0].state, at: f.checkIns[0].createdAt } : null,
      }));
    res.json({ fridges: out });
  }),
);
