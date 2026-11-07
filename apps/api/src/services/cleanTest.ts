import type { PrismaClient } from "@prisma/client";
import { TEST_EMAIL_SUFFIX } from "./rules.js";
import { recomputeBulk } from "./orgs.js";

/**
 * Deletes every test account (email ending in @example.test, used by the e2e suite and smoke tests) and
 * everything those accounts created, so a live demo database stays clean without a full reseed.
 * Real and @demo.freshshare.de accounts are untouched, apart from losing ratings and messages from test users.
 */
export async function cleanTestUsers(prisma: PrismaClient) {
  const users = (await prisma.user.findMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } }, select: { id: true } })).map((u) => u.id);
  const signups = await prisma.earlyAccessSignup.deleteMany({ where: { email: { endsWith: TEST_EMAIL_SUFFIX } } });
  if (users.length === 0) return { users: 0, listings: 0, earlyAccess: signups.count };

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
  const orgs = ids(await prisma.organization.findMany({ where: { createdById: { in: users } }, select: { id: true } }));
  const fridges = ids(await prisma.fridge.findMany({ where: { createdById: { in: users }, status: { not: "active" } }, select: { id: true } }));
  const listings = ids(await prisma.listing.findMany({ where: { giverId: { in: users } }, select: { id: true } }));
  const claims = ids(
    await prisma.claim.findMany({
      where: { OR: [{ receiverId: { in: users } }, { listingId: { in: listings } }, { organizationId: { in: orgs } }] },
      select: { id: true },
    }),
  );
  const bulks = ids(await prisma.bulkClaim.findMany({ where: { OR: [{ organizationId: { in: orgs } }, { createdById: { in: users } }] }, select: { id: true } }));
  const touchedBulks = (
    await prisma.bulkClaimItem.findMany({
      where: { OR: [{ claimId: { in: claims } }, { listingId: { in: listings } }], bulkClaimId: { notIn: bulks } },
      select: { bulkClaimId: true },
    })
  ).map((i) => i.bulkClaimId);
  const ratedUsers = (await prisma.rating.findMany({ where: { OR: [{ fromUserId: { in: users } }, { claimId: { in: claims } }] }, select: { toUserId: true } })).map(
    (r) => r.toUserId,
  );

  await prisma.$transaction([
    prisma.bulkClaimItem.deleteMany({ where: { OR: [{ bulkClaimId: { in: bulks } }, { claimId: { in: claims } }, { listingId: { in: listings } }] } }),
    prisma.claim.updateMany({ where: { bulkClaimId: { in: bulks } }, data: { bulkClaimId: null } }),
    prisma.bulkClaim.deleteMany({ where: { id: { in: bulks } } }),
    prisma.message.deleteMany({ where: { OR: [{ claimId: { in: claims } }, { senderId: { in: users } }] } }),
    prisma.rating.deleteMany({ where: { OR: [{ claimId: { in: claims } }, { fromUserId: { in: users } }, { toUserId: { in: users } }] } }),
    prisma.report.deleteMany({ where: { OR: [{ userId: { in: users } }, { reportedUserId: { in: users } }, { listingId: { in: listings } }] } }),
    prisma.notification.deleteMany({ where: { OR: [{ userId: { in: users } }, { listingId: { in: listings } }] } }),
    prisma.alertSubscription.deleteMany({ where: { userId: { in: users } } }),
    prisma.pushSubscription.deleteMany({ where: { userId: { in: users } } }),
    prisma.listingSchedule.deleteMany({ where: { userId: { in: users } } }),
    prisma.block.deleteMany({ where: { OR: [{ blockerId: { in: users } }, { blockedId: { in: users } }] } }),
    prisma.listingWaitlist.deleteMany({ where: { OR: [{ userId: { in: users } }, { listingId: { in: listings } }] } }),
    prisma.claim.deleteMany({ where: { id: { in: claims } } }),
    prisma.listing.deleteMany({ where: { id: { in: listings } } }),
    prisma.fridgeCheckIn.deleteMany({ where: { OR: [{ userId: { in: users } }, { fridgeId: { in: fridges } }] } }),
    prisma.listing.updateMany({ where: { fridgeId: { in: fridges } }, data: { fridgeId: null } }),
    prisma.fridge.deleteMany({ where: { id: { in: fridges } } }),
    prisma.fridge.updateMany({ where: { createdById: { in: users } }, data: { createdById: null } }),
    prisma.fridge.updateMany({ where: { reviewedById: { in: users } }, data: { reviewedById: null } }),
    prisma.organizationDocument.deleteMany({ where: { organizationId: { in: orgs } } }),
    prisma.organizationMember.deleteMany({ where: { OR: [{ organizationId: { in: orgs } }, { userId: { in: users } }] } }),
    prisma.organization.deleteMany({ where: { id: { in: orgs } } }),
    prisma.organization.updateMany({ where: { verifiedById: { in: users } }, data: { verifiedById: null } }),
    prisma.user.deleteMany({ where: { id: { in: users } } }),
  ]);

  for (const b of new Set(touchedBulks)) await recomputeBulk(b);
  for (const id of new Set(ratedUsers.filter((u) => !users.includes(u)))) {
    const agg = await prisma.rating.aggregate({ where: { toUserId: id }, _avg: { stars: true }, _count: true });
    await prisma.user.update({ where: { id }, data: { ratingAvg: agg._avg.stars ?? 0, ratingCount: agg._count } });
  }
  return { users: users.length, listings: listings.length, earlyAccess: signups.count };
}
