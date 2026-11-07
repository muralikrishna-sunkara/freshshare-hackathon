import type { Prisma } from "@prisma/client";
import { HttpError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { giverView, publicListing } from "./listings.js";
import { HOMEMADE_MAX_HOURS } from "./rules.js";

export const HOLD_MINUTES = 30;
export const ACTIVE = ["pending", "confirmed"] as const;

const claimInclude = { listing: { include: { giver: true } }, receiver: true, ratings: true } satisfies Prisma.ClaimInclude;
export type ClaimFull = Prisma.ClaimGetPayload<{ include: typeof claimInclude }>;

export async function loadClaim(id: string, viewerId: string): Promise<ClaimFull & { role: "giver" | "receiver" }> {
  const c = await prisma.claim.findUnique({ where: { id }, include: claimInclude });
  if (!c) throw new HttpError(404, "not_found", "Pickup not found");
  const role = c.receiverId === viewerId ? "receiver" : c.listing.giverId === viewerId ? "giver" : null;
  if (!role) throw new HttpError(403, "forbidden", "Only the giver and the receiver can see this pickup");
  return { ...c, role };
}

/** Exact location and handover spot only once the giver has confirmed. */
export function claimView(c: ClaimFull, role: "giver" | "receiver") {
  const revealed = role === "giver" || c.status === "confirmed" || c.status === "collected";
  return {
    id: c.id,
    status: c.status,
    holdUntil: c.holdUntil,
    createdAt: c.createdAt,
    role,
    listing: {
      ...publicListing(c.listing),
      ...(revealed ? { lat: c.listing.lat, lng: c.listing.lng, handoverSpot: c.listing.handoverSpot } : {}),
    },
    receiver: giverView(c.receiver),
    myRating: c.ratings.find((r) => r.fromUserId === (role === "giver" ? c.listing.giverId : c.receiverId))?.stars ?? null,
  };
}

export async function reserve(listingId: string, receiverId: string) {
  return prisma.$transaction(async (tx) => {
    const l = await tx.listing.findUnique({ where: { id: listingId } });
    if (!l || l.status === "removed") throw new HttpError(404, "not_found", "Listing not found");
    if (l.giverId === receiverId) throw new HttpError(400, "own_listing", "You can't reserve your own food");
    // Atomic guard: only one request can flip available -> reserved.
    const flipped = await tx.listing.updateMany({
      where: { id: listingId, status: "available", bestBefore: { gt: new Date() } },
      data: { status: "reserved" },
    });
    if (flipped.count === 0) throw new HttpError(409, "not_available", "Someone else has already reserved this");
    return tx.claim.create({
      data: { listingId, receiverId, holdUntil: new Date(Date.now() + HOLD_MINUTES * 60_000) },
      include: claimInclude,
    });
  });
}

export async function transition(id: string, viewerId: string, action: "confirm" | "collected" | "cancel") {
  const c = await loadClaim(id, viewerId);
  if (action === "confirm") {
    if (c.role !== "giver") throw new HttpError(403, "forbidden", "Only the giver can confirm");
    if (c.status !== "pending") throw new HttpError(409, "bad_state", `This pickup is already ${c.status}`);
    if (c.holdUntil < new Date()) throw new HttpError(409, "hold_lapsed", "The 30-minute hold has run out");
    await prisma.claim.update({ where: { id }, data: { status: "confirmed" } });
  } else if (action === "collected") {
    if (c.status !== "confirmed") throw new HttpError(409, "bad_state", "The giver has to confirm before pickup");
    await prisma.$transaction([
      prisma.claim.update({ where: { id }, data: { status: "collected" } }),
      prisma.listing.update({ where: { id: c.listingId }, data: { status: "collected" } }),
    ]);
  } else {
    if (!ACTIVE.includes(c.status as (typeof ACTIVE)[number])) throw new HttpError(409, "bad_state", `This pickup is already ${c.status}`);
    await prisma.$transaction([
      prisma.claim.update({ where: { id }, data: { status: "cancelled" } }),
      prisma.listing.updateMany({ where: { id: c.listingId, status: "reserved" }, data: { status: "available" } }),
    ]);
  }
  return loadClaim(id, viewerId);
}

/** Every minute: lapse expired holds (freeing the listing) and expire old listings. */
export async function housekeeping(now = new Date()) {
  const lapsed = await prisma.claim.findMany({ where: { status: "pending", holdUntil: { lt: now } }, select: { id: true, listingId: true } });
  for (const c of lapsed) {
    await prisma.$transaction([
      prisma.claim.update({ where: { id: c.id }, data: { status: "lapsed" } }),
      prisma.listing.updateMany({ where: { id: c.listingId, status: "reserved" }, data: { status: "available" } }),
    ]);
  }
  const homemadeCutoff = new Date(now.getTime() - HOMEMADE_MAX_HOURS * 3600_000);
  const expired = await prisma.listing.updateMany({
    where: {
      status: "available",
      OR: [{ bestBefore: { lte: now } }, { origin: "homemade", createdAt: { lt: homemadeCutoff } }],
    },
    data: { status: "expired" },
  });
  if (lapsed.length || expired.count) logger.info({ lapsed: lapsed.length, expired: expired.count }, "housekeeping");
  return { lapsed: lapsed.length, expired: expired.count };
}

export async function myClaims(userId: string) {
  const [asReceiver, asGiver] = await Promise.all([
    prisma.claim.findMany({ where: { receiverId: userId }, include: claimInclude, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.claim.findMany({ where: { listing: { giverId: userId } }, include: claimInclude, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return {
    asReceiver: asReceiver.map((c) => claimView(c, "receiver")),
    asGiver: asGiver.map((c) => claimView(c, "giver")),
  };
}
