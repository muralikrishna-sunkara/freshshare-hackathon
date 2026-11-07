import { prisma } from "../lib/prisma.js";
import { recomputeBulk } from "./orgs.js";
import { offerToNext } from "./waitlist.js";

/**
 * T2.5: suspend an account. Their food comes off the map, their open pickups (both sides) are cancelled
 * and they leave every waitlist. They can't sign in; the reason is shown on the sign-in page.
 */
export async function suspendUser(userId: string, reason: string) {
  await prisma.user.update({ where: { id: userId }, data: { suspendedAt: new Date(), suspendedReason: reason } });
  const open = await prisma.claim.findMany({
    where: { status: { in: ["pending", "confirmed"] }, OR: [{ receiverId: userId }, { listing: { giverId: userId } }] },
    select: { id: true, listingId: true, bulkClaimId: true, listing: { select: { giverId: true } } },
  });
  await prisma.$transaction([
    prisma.claim.updateMany({ where: { id: { in: open.map((c) => c.id) } }, data: { status: "cancelled" } }),
    prisma.listing.updateMany({ where: { giverId: userId, status: { in: ["available", "reserved"] } }, data: { status: "removed" } }),
    prisma.listingWaitlist.deleteMany({ where: { userId } }),
  ]);
  // Food they had reserved from others goes back on the map (or to the next person waiting).
  for (const c of open.filter((x) => x.listing.giverId !== userId)) {
    await prisma.listing.updateMany({ where: { id: c.listingId, status: "reserved" }, data: { status: "available" } });
    await offerToNext(c.listingId);
  }
  for (const b of new Set(open.map((c) => c.bulkClaimId).filter((x): x is string => !!x))) await recomputeBulk(b);
}
