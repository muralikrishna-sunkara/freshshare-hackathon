import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { offerToNext } from "../services/waitlist.js";

export const users = Router();

/** T2.5: people I blocked (to unblock them from the profile page). */
users.get(
  "/blocks/mine",
  requireAuth,
  ah(async (req, res) => {
    const rows = await prisma.block.findMany({ where: { blockerId: userId(req) }, orderBy: { createdAt: "desc" } });
    const people = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.blockedId) } }, select: { id: true, name: true } });
    res.json({ blocked: people });
  }),
);

const idParam = z.object({ id: z.string().min(1).max(40) });

/**
 * Block someone: their listings disappear from your map (and yours from theirs), you can't reserve from
 * each other, and chats between you are hidden. Open reservations between you are cancelled.
 */
users.post(
  "/:id/block",
  requireAuth,
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const me = userId(req);
    if (id === me) throw new HttpError(400, "self", "You can't block yourself");
    if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, "not_found", "This person doesn't exist");
    await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: me, blockedId: id } }, create: { blockerId: me, blockedId: id }, update: {} });
    const open = await prisma.claim.findMany({
      where: {
        status: { in: ["pending", "confirmed"] },
        OR: [
          { receiverId: me, listing: { giverId: id } },
          { receiverId: id, listing: { giverId: me } },
        ],
      },
      select: { id: true, listingId: true },
    });
    for (const c of open) {
      await prisma.$transaction([
        prisma.claim.update({ where: { id: c.id }, data: { status: "cancelled" } }),
        prisma.listing.updateMany({ where: { id: c.listingId, status: "reserved" }, data: { status: "available" } }),
      ]);
      await offerToNext(c.listingId);
    }
    await prisma.listingWaitlist.deleteMany({ where: { OR: [{ userId: me, listing: { giverId: id } }, { userId: id, listing: { giverId: me } }] } });
    res.status(201).json({ blocked: true, cancelledPickups: open.length });
  }),
);

users.delete(
  "/:id/block",
  requireAuth,
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await prisma.block.deleteMany({ where: { blockerId: userId(req), blockedId: id } });
    res.json({ blocked: false });
  }),
);

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
        blockedByMe: req.user ? (await prisma.block.count({ where: { blockerId: req.user.id, blockedId: u.id } })) > 0 : false,
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
