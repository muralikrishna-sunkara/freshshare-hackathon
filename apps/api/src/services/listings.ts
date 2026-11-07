import { Prisma, type Category } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { areaLabel } from "../lib/geocode.js";
import { roundDistance } from "../lib/geo.js";

type GiverRow = { id: string; name: string; emailVerified: boolean; phoneVerified: boolean; ratingAvg: number; ratingCount: number };

export const giverView = (u: GiverRow) => ({
  id: u.id,
  name: u.name,
  verified: u.emailVerified && u.phoneVerified,
  ratingAvg: Math.round(u.ratingAvg * 10) / 10,
  ratingCount: u.ratingCount,
});

/** Public fields of a listing. Never includes exact lat/lng. */
export function publicListing(
  l: Prisma.ListingGetPayload<{ include: { giver: true } }> & { fridge?: { id: string; name: string; address: string } | null },
  distanceM?: number,
) {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    category: l.category,
    origin: l.origin,
    allergens: l.allergens,
    bestBefore: l.bestBefore,
    photoUrl: l.photoUrl,
    photos: l.photos.length ? l.photos : [l.photoUrl],
    dietaryTags: l.dietaryTags,
    weightKg: l.weightKg,
    areaLabel: areaLabel(l),
    publicLat: l.publicLat,
    publicLng: l.publicLng,
    pickupFrom: l.pickupFrom,
    pickupUntil: l.pickupUntil,
    portions: l.portions,
    status: l.status,
    createdAt: l.createdAt,
    hasHandoverSpot: l.handoverSpot !== null,
    ...(distanceM !== undefined ? { distanceM: roundDistance(distanceM) } : {}),
    giver: giverView(l.giver),
    // Dropped at a community fridge: that place is public, so name and address are shown to everyone.
    fridge: l.fridge ? { id: l.fridge.id, name: l.fridge.name, address: l.fridge.address } : l.fridgeId ? { id: l.fridgeId } : null,
  };
}

export async function findNearby(lat: number, lng: number, radius: number, category?: Category, diet?: string) {
  const latD = radius / 111320;
  const lngD = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  const rows = await prisma.$queryRaw<{ id: string; distance_m: number }[]>`
    SELECT id, distance_m FROM (
      SELECT id, 6371000 * 2 * asin(sqrt(
        power(sin(radians(lat - ${lat}) / 2), 2) +
        cos(radians(${lat})) * cos(radians(lat)) * power(sin(radians(lng - ${lng}) / 2), 2)
      )) AS distance_m
      FROM "Listing"
      WHERE status = 'available'
        AND "bestBefore" > now()
        AND NOT (origin = 'homemade' AND "createdAt" < now() - interval '48 hours')
        AND lat BETWEEN ${lat - latD} AND ${lat + latD}
        AND lng BETWEEN ${lng - lngD} AND ${lng + lngD}
        ${category ? Prisma.sql`AND category = ${category}::"Category"` : Prisma.empty}
        ${diet ? Prisma.sql`AND ${diet} = ANY("dietaryTags")` : Prisma.empty}
    ) t
    WHERE distance_m <= ${radius}
    ORDER BY distance_m
    LIMIT 100`;
  if (rows.length === 0) return [];
  const listings = await prisma.listing.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: { giver: true, fridge: true } });
  const byId = new Map(listings.map((l) => [l.id, l]));
  return rows.flatMap((r) => {
    const l = byId.get(r.id);
    return l ? [publicListing(l, r.distance_m)] : [];
  });
}
