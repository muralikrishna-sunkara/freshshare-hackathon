import { Prisma } from "@prisma/client";
import { HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { loadClaim } from "./claims.js";

/** One rating per side after pickup. The rated user's average is updated incrementally so seeded history is kept. */
export async function rateClaim(claimId: string, fromUserId: string, stars: number, note: string | null) {
  const c = await loadClaim(claimId, fromUserId);
  if (c.status !== "collected") throw new HttpError(409, "not_collected", "You can rate once the food has been collected");
  const toUserId = c.role === "receiver" ? c.listing.giverId : c.receiverId;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.rating.create({ data: { claimId, fromUserId, toUserId, stars, note } });
      const u = await tx.user.findUniqueOrThrow({ where: { id: toUserId } });
      const count = u.ratingCount + 1;
      await tx.user.update({ where: { id: toUserId }, data: { ratingCount: count, ratingAvg: (u.ratingAvg * u.ratingCount + stars) / count } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "already_rated", "You've already rated this pickup");
    }
    throw e;
  }
  return loadClaim(claimId, fromUserId);
}
