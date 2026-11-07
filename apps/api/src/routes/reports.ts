import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { REPORT_REASONS } from "../services/rules.js";

export const reports = Router();

const body = z
  .object({
    listingId: z.string().min(1).max(40).optional(),
    userId: z.string().min(1).max(40).optional(),
    reason: z.enum(REPORT_REASONS, { errorMap: () => ({ message: "Please pick a reason" }) }),
    note: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
  })
  .refine((b) => !!b.listingId !== !!b.userId, { message: "Report either a listing or a person" });

/** Report a listing or a person. Goes to the admin queue. Repeating an open report doesn't duplicate it. */
reports.post(
  "/",
  requireAuth,
  ah(async (req, res) => {
    const b = body.parse(req.body);
    const me = userId(req);
    if (b.listingId) {
      const l = await prisma.listing.findUnique({ where: { id: b.listingId }, select: { giverId: true } });
      if (!l) throw new HttpError(404, "not_found", "Listing not found");
      if (l.giverId === me) throw new HttpError(400, "own_listing", "You can't report your own listing");
    } else {
      if (b.userId === me) throw new HttpError(400, "self_report", "You can't report yourself");
      if (!(await prisma.user.findUnique({ where: { id: b.userId! }, select: { id: true } }))) throw new HttpError(404, "not_found", "Person not found");
    }
    const existing = await prisma.report.findFirst({
      where: { userId: me, status: "open", listingId: b.listingId ?? null, reportedUserId: b.userId ?? null },
    });
    if (!existing) {
      await prisma.report.create({
        data: { userId: me, listingId: b.listingId ?? null, reportedUserId: b.userId ?? null, reason: b.reason, note: b.note },
      });
    }
    res.status(201).json({ ok: true, message: "Thanks for telling us. Our moderators will look at it." });
  }),
);
