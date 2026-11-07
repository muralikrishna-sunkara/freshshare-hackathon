import { Router } from "express";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export const users = Router();

/** Public profile: open to visitors. Never returns email or location. */
users.get(
  "/:id",
  ah(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u) throw new HttpError(404, "not_found", "This person doesn't exist");
    const [shared, given, received, reviews] = await Promise.all([
      prisma.listing.count({ where: { giverId: u.id, status: { not: "removed" } } }),
      prisma.claim.count({ where: { listing: { giverId: u.id }, status: "collected" } }),
      prisma.claim.count({ where: { receiverId: u.id, status: "collected" } }),
      prisma.rating.findMany({ where: { toUserId: u.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    const authors = await prisma.user.findMany({
      where: { id: { in: [...new Set(reviews.map((r) => r.fromUserId))] } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(authors.map((a) => [a.id, a.name]));
    res.json({
      user: {
        id: u.id,
        name: u.name,
        bio: u.bio,
        verified: u.emailVerified && u.phoneVerified,
        ratingAvg: Math.round(u.ratingAvg * 10) / 10,
        ratingCount: u.ratingCount,
        memberSince: u.createdAt,
        stats: { shared, given, received },
        reviews: reviews.map((r) => ({
          id: r.id,
          stars: r.stars,
          note: r.note,
          createdAt: r.createdAt,
          from: { id: r.fromUserId, name: nameOf.get(r.fromUserId) ?? "A neighbour" },
        })),
      },
    });
  }),
);
