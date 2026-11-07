import { HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { notify } from "./notify.js";

/** How long the first person on the waitlist has the food to themselves after a claim falls through. */
export const WAITLIST_HOLD_MINUTES = 30;

/** Is this listing held for someone else right now? */
export const heldForOther = (l: { reservedForUserId: string | null; reservedUntil: Date | null }, userId: string, now = new Date()) =>
  !!l.reservedForUserId && l.reservedForUserId !== userId && !!l.reservedUntil && l.reservedUntil > now;

export async function joinWaitlist(listingId: string, userId: string) {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, include: { claims: { where: { status: { in: ["pending", "confirmed"] } }, select: { receiverId: true } } } });
  if (!l || l.status === "removed") throw new HttpError(404, "not_found", "Listing not found");
  if (l.giverId === userId) throw new HttpError(400, "own_listing", "This is your own listing");
  if (l.claims.some((c) => c.receiverId === userId)) throw new HttpError(409, "already_reserved", "You already have this reserved");
  const taken = l.status === "reserved" || heldForOther(l, userId);
  if (!taken) throw new HttpError(409, "still_available", "This food is still available. Reserve it instead.");
  if (l.bestBefore <= new Date() || l.pickupUntil <= new Date()) throw new HttpError(409, "ended", "The pickup window for this food is over");
  return prisma.$transaction(async (tx) => {
    const mine = await tx.listingWaitlist.findUnique({ where: { listingId_userId: { listingId, userId } } });
    if (mine) return mine;
    const last = await tx.listingWaitlist.aggregate({ where: { listingId }, _max: { position: true } });
    return tx.listingWaitlist.create({ data: { listingId, userId, position: (last._max.position ?? 0) + 1 } });
  });
}

export async function leaveWaitlist(listingId: string, userId: string) {
  await prisma.listingWaitlist.deleteMany({ where: { listingId, userId } });
}

/** 1-based place in line (null if not on the list) and how many are waiting. */
export async function waitlistStatus(listingId: string, userId: string | undefined) {
  const rows = await prisma.listingWaitlist.findMany({ where: { listingId }, orderBy: { position: "asc" }, select: { userId: true } });
  const idx = userId ? rows.findIndex((r) => r.userId === userId) : -1;
  return { count: rows.length, myPosition: idx >= 0 ? idx + 1 : null };
}

/**
 * Called whenever a listing becomes free again (claim cancelled, declined or lapsed, or a waitlist hold ran out).
 * The first person in line gets a 30-minute exclusive hold and a waitlist_offer notification; with nobody
 * waiting the hold is cleared and the listing is open to everyone.
 */
export async function offerToNext(listingId: string, now = new Date()) {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, title: true, status: true, bestBefore: true, pickupUntil: true } });
  if (!l) return null;
  const usable = l.status === "available" && l.bestBefore > now && l.pickupUntil > now;
  const next = usable ? await prisma.listingWaitlist.findFirst({ where: { listingId }, orderBy: { position: "asc" } }) : null;
  if (!next) {
    await prisma.listing.update({ where: { id: listingId }, data: { reservedForUserId: null, reservedUntil: null } });
    if (!usable) await prisma.listingWaitlist.deleteMany({ where: { listingId } });
    return null;
  }
  const until = new Date(now.getTime() + WAITLIST_HOLD_MINUTES * 60_000);
  await prisma.$transaction([
    prisma.listingWaitlist.delete({ where: { id: next.id } }),
    prisma.listing.update({ where: { id: listingId }, data: { reservedForUserId: next.userId, reservedUntil: until } }),
  ]);
  await notify(next.userId, {
    type: "waitlist_offer",
    title: `${l.title} is free again, and it's yours first`,
    body: `You were first on the waitlist. Reserve it within ${WAITLIST_HOLD_MINUTES} minutes before it goes to the next person.`,
    link: `/listings/${listingId}`,
    listingId,
  });
  return next.userId;
}

/** Every minute: pass on waitlist holds that ran out. */
export async function waitlistHousekeeping(now = new Date()) {
  const expired = await prisma.listing.findMany({ where: { reservedForUserId: { not: null }, reservedUntil: { lt: now } }, select: { id: true } });
  for (const l of expired) await offerToNext(l.id, now);
  return expired.length;
}
