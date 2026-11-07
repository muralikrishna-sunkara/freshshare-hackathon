import type { Prisma } from "@prisma/client";
import { HttpError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { giverView, publicListing } from "./listings.js";
import { notify } from "./notify.js";
import { recomputeBulk } from "./orgs.js";
import { randomInt } from "node:crypto";
import { HOMEMADE_MAX_HOURS } from "./rules.js";
import { isBlockedBetween } from "./blocks.js";
import { postDueSchedules } from "./schedules.js";
import { heldForOther, offerToNext, waitlistHousekeeping } from "./waitlist.js";

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
    // T2.6: the receiver shows this (as a QR code or 6 digits) and the giver enters or scans it to complete the pickup.
    ...(role === "receiver" && c.status === "confirmed" && c.pickupCode ? { pickupCode: c.pickupCode } : {}),
    myRating: c.ratings.find((r) => r.fromUserId === (role === "giver" ? c.listing.giverId : c.receiverId))?.stars ?? null,
  };
}

export async function reserve(listingId: string, receiverId: string) {
  const claim = await reserveTx(listingId, receiverId);
  await notify(claim.listing.giverId, {
    type: "claim_received",
    title: `${firstName(claim.receiver.name)} would like your ${claim.listing.title}`,
    body: `Confirm within ${HOLD_MINUTES} minutes or the hold runs out. Your exact address is shared only after you confirm.`,
    link: `/pickups/${claim.id}`,
    listingId,
    claimId: claim.id,
  });
  return claim;
}

const firstName = (name: string) => name.split(" ")[0];

async function reserveTx(listingId: string, receiverId: string) {
  return prisma.$transaction(async (tx) => {
    const l = await tx.listing.findUnique({ where: { id: listingId } });
    if (!l || l.status === "removed") throw new HttpError(404, "not_found", "Listing not found");
    if (l.giverId === receiverId) throw new HttpError(400, "own_listing", "You can't reserve your own food");
    if (await isBlockedBetween(l.giverId, receiverId)) throw new HttpError(403, "blocked", "You can't reserve food from this person");
    const now = new Date();
    if (l.status === "available" && heldForOther(l, receiverId, now)) {
      throw new HttpError(409, "held_for_waitlist", "This food is being offered to the next person on the waitlist. Join the waitlist to be next.");
    }
    // Atomic guard: only one request can flip available -> reserved (and only the waitlist holder while a hold runs).
    const flipped = await tx.listing.updateMany({
      where: {
        id: listingId,
        status: "available",
        bestBefore: { gt: now },
        OR: [{ reservedForUserId: null }, { reservedForUserId: receiverId }, { reservedUntil: { lt: now } }],
      },
      data: { status: "reserved", reservedForUserId: null, reservedUntil: null },
    });
    if (flipped.count === 0) throw new HttpError(409, "not_available", "Someone else was quicker. This food has just been reserved.");
    return tx.claim.create({
      data: { listingId, receiverId, holdUntil: new Date(Date.now() + HOLD_MINUTES * 60_000) },
      include: claimInclude,
    });
  });
}

export async function transition(id: string, viewerId: string, action: "confirm" | "collected" | "cancel" | "decline") {
  const c = await loadClaim(id, viewerId);
  if (action === "confirm") {
    if (c.role !== "giver") throw new HttpError(403, "forbidden", "Only the giver can confirm");
    if (c.status !== "pending") throw new HttpError(409, "bad_state", `This pickup is already ${c.status}`);
    if (c.holdUntil < new Date()) throw new HttpError(409, "hold_lapsed", "The 30-minute hold has run out");
    await prisma.claim.update({ where: { id }, data: { status: "confirmed", pickupCode: newPickupCode() } });
  } else if (action === "decline") {
    if (c.role !== "giver") throw new HttpError(403, "forbidden", "Only the giver can decline");
    if (c.status !== "pending") throw new HttpError(409, "bad_state", `This pickup is already ${c.status}`);
    await prisma.$transaction([
      prisma.claim.update({ where: { id }, data: { status: "declined" } }),
      prisma.listing.updateMany({ where: { id: c.listingId, status: "reserved" }, data: { status: "available" } }),
    ]);
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
  if (c.bulkClaimId) await recomputeBulk(c.bulkClaimId);
  if (action === "decline" || action === "cancel") await offerToNext(c.listingId);
  await notifyTransition(c, action);
  return loadClaim(id, viewerId);
}

async function notifyTransition(c: ClaimFull & { role: "giver" | "receiver" }, action: "confirm" | "collected" | "cancel" | "decline") {
  const giver = c.listing.giver;
  const base = { link: `/pickups/${c.id}`, listingId: c.listingId, claimId: c.id };
  if (action === "confirm") {
    await notify(c.receiverId, {
      ...base,
      type: "claim_confirmed",
      title: `${firstName(giver.name)} confirmed your pickup`,
      body: `${c.listing.title}: the address and pickup details are now on the pickup page. Pickup until ${c.listing.pickupUntil.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}.`,
    });
  } else if (action === "decline") {
    await notify(c.receiverId, { ...base, type: "claim_cancelled", title: `${c.listing.title} isn't available for you`, body: `${firstName(giver.name)} couldn't hand it over this time. Have a look for more food nearby.`, link: "/map" });
  } else if (action === "cancel") {
    const toGiver = c.role === "receiver";
    await notify(toGiver ? giver.id : c.receiverId, {
      ...base,
      type: "claim_cancelled",
      title: toGiver ? `${firstName(c.receiver.name)} cancelled the pickup` : `${firstName(giver.name)} cancelled your pickup`,
      body: toGiver ? `${c.listing.title} is back on the map for others.` : `${c.listing.title} is no longer reserved for you.`,
      link: toGiver ? `/listings/${c.listingId}` : "/map",
    });
  }
}

/** Pickup windows ending within this time trigger one listing_expiring_soon reminder to the giver. */
export const EXPIRING_SOON_MS = 60 * 60_000;

/** Every minute: lapse expired holds (freeing the listing) and expire old listings. */
export async function housekeeping(now = new Date()) {
  const lapsed = await prisma.claim.findMany({
    where: { status: "pending", holdUntil: { lt: now } },
    select: { id: true, listingId: true, bulkClaimId: true, receiverId: true },
  });
  for (const c of lapsed) {
    await prisma.$transaction([
      prisma.claim.update({ where: { id: c.id }, data: { status: "lapsed" } }),
      prisma.listing.updateMany({ where: { id: c.listingId, status: "reserved" }, data: { status: "available" } }),
    ]);
    if (c.bulkClaimId) await recomputeBulk(c.bulkClaimId);
    await offerToNext(c.listingId, now);
    await notify(c.receiverId, {
      type: "claim_cancelled",
      title: "Your reservation ran out",
      body: `The giver didn't confirm within ${HOLD_MINUTES} minutes, so the food is back on the map.`,
      link: "/map",
      listingId: c.listingId,
      claimId: c.id,
    });
  }
  // One reminder per listing when its pickup window is about to end with nobody coming.
  const ending = await prisma.listing.findMany({
    where: { status: "available", pickupUntil: { gt: now, lte: new Date(now.getTime() + EXPIRING_SOON_MS) } },
    select: { id: true, giverId: true, title: true },
  });
  if (ending.length) {
    const already = new Set(
      (await prisma.notification.findMany({ where: { type: "listing_expiring_soon", listingId: { in: ending.map((l) => l.id) } }, select: { listingId: true } })).map((n) => n.listingId),
    );
    for (const l of ending.filter((x) => !already.has(x.id))) {
      await notify(l.giverId, {
        type: "listing_expiring_soon",
        title: `${l.title}: pickup ends within the hour`,
        body: "Nobody has reserved it yet. Extend the pickup time by posting it again, or drop it at a community fridge.",
        link: `/listings/${l.id}`,
        listingId: l.id,
      });
    }
  }
  const homemadeCutoff = new Date(now.getTime() - HOMEMADE_MAX_HOURS * 3600_000);
  const expired = await prisma.listing.updateMany({
    where: {
      status: "available",
      OR: [{ bestBefore: { lte: now } }, { origin: "homemade", createdAt: { lt: homemadeCutoff } }],
    },
    data: { status: "expired" },
  });
  const passedOn = await waitlistHousekeeping(now);
  const recurring = await postDueSchedules(now);
  if (lapsed.length || expired.count || passedOn || recurring) logger.info({ lapsed: lapsed.length, expired: expired.count, passedOn, recurring }, "housekeeping");
  return { lapsed: lapsed.length, expired: expired.count, passedOn, recurring };
}

/** 6 random digits for the handover check (T2.6). */
export const newPickupCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** T2.6: the giver types (or scans) the receiver's code; a match marks the pickup collected. */
export async function verifyPickupCode(id: string, viewerId: string, code: string) {
  const c = await loadClaim(id, viewerId);
  if (c.role !== "giver") throw new HttpError(403, "forbidden", "Only the giver checks the pickup code");
  if (c.status !== "confirmed") throw new HttpError(409, "bad_state", c.status === "collected" ? "This pickup is already completed" : "Confirm the pickup first");
  if (!c.pickupCode || c.pickupCode !== code) throw new HttpError(400, "wrong_code", "That code doesn't match. Ask to see the code on their pickup page.");
  return transition(id, viewerId, "collected");
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
