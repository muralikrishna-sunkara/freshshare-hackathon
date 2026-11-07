import { Router } from "express";
import { z } from "zod";
import { requireAdmin, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { recomputeBulk } from "../services/orgs.js";

export const admin = Router();
admin.use(requireAdmin);

const idParam = z.string().min(1).max(40);

/** Everything waiting for an admin: suggested fridges and registered organizations. */
admin.get(
  "/pending",
  ah(async (_req, res) => {
    const [fridges, orgs] = await Promise.all([
      prisma.fridge.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" } }),
      prisma.organization.findMany({
        where: { status: { in: ["pending", "under_review"] } },
        orderBy: { createdAt: "asc" },
        include: { documents: { select: { id: true, filename: true, contentType: true, size: true } } },
      }),
    ]);
    const creators = await prisma.user.findMany({
      where: { id: { in: [...fridges.map((f) => f.createdById), ...orgs.map((o) => o.createdById)].filter((x): x is string => !!x) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(creators.map((c) => [c.id, c.name]));
    res.json({
      fridges: fridges.map((f) => ({ ...f, createdBy: f.createdById ? { id: f.createdById, name: nameOf.get(f.createdById) } : null })),
      organizations: orgs.map((o) => ({ ...o, createdBy: { id: o.createdById, name: nameOf.get(o.createdById) } })),
    });
  }),
);

admin.post(
  "/fridges/:id/:decision(approve|reject)",
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const status = req.params.decision === "approve" ? "active" : "rejected";
    const r = await prisma.fridge.updateMany({ where: { id, status: "pending" }, data: { status, reviewedById: userId(req) } });
    if (r.count === 0) throw new HttpError(404, "not_found", "No pending fridge with that id");
    res.json({ ok: true, status });
  }),
);

admin.post(
  "/organizations/:id/:decision(approve|reject)",
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const approve = req.params.decision === "approve";
    const r = await prisma.organization.updateMany({
      where: { id, status: { in: ["pending", "under_review"] } },
      data: approve ? { status: "approved", verifiedById: userId(req), verifiedAt: new Date() } : { status: "rejected", verifiedById: userId(req) },
    });
    if (r.count === 0) throw new HttpError(404, "not_found", "No pending organization with that id");
    res.json({ ok: true, status: approve ? "approved" : "rejected" });
  }),
);

/** Open reports, newest first, with what was reported and by whom. `?status=resolved` shows the history. */
admin.get(
  "/reports",
  ah(async (req, res) => {
    const { status } = z.object({ status: z.enum(["open", "resolved"]).default("open") }).parse(req.query);
    const rows = await prisma.report.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 100 });
    const listingIds = rows.map((r) => r.listingId).filter((x): x is string => !!x);
    const userIds = rows.flatMap((r) => [r.userId, r.reportedUserId]).filter((x): x is string => !!x);
    const [listings, users] = await Promise.all([
      prisma.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true, title: true, status: true, photoUrl: true, giverId: true } }),
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    ]);
    const listingOf = new Map(listings.map((l) => [l.id, l]));
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    res.json({
      reports: rows.map((r) => ({
        id: r.id, reason: r.reason, note: r.note, status: r.status, createdAt: r.createdAt, resolvedAt: r.resolvedAt,
        reporter: { id: r.userId, name: nameOf.get(r.userId) ?? "Unknown" },
        listing: r.listingId ? listingOf.get(r.listingId) ?? null : null,
        reportedUser: r.reportedUserId ? { id: r.reportedUserId, name: nameOf.get(r.reportedUserId) ?? "Unknown" } : null,
      })),
    });
  }),
);

/**
 * Resolve a report. `action: "remove_listing"` also takes the listing off the map and cancels any active
 * reservation on it (other open reports for the same listing are resolved with it).
 */
admin.post(
  "/reports/:id/resolve",
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { action } = z.object({ action: z.enum(["dismiss", "remove_listing"]).default("dismiss") }).parse(req.body ?? {});
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || report.status !== "open") throw new HttpError(404, "not_found", "No open report with that id");
    const me = userId(req);
    const done = { status: "resolved" as const, resolvedBy: me, resolvedAt: new Date() };
    if (action === "remove_listing") {
      if (!report.listingId) throw new HttpError(400, "no_listing", "This report is about a person, not a listing");
      const listingId = report.listingId;
      const active = await prisma.claim.findMany({ where: { listingId, status: { in: ["pending", "confirmed"] } }, select: { bulkClaimId: true } });
      await prisma.$transaction([
        prisma.listing.update({ where: { id: listingId }, data: { status: "removed" } }),
        prisma.claim.updateMany({ where: { listingId, status: { in: ["pending", "confirmed"] } }, data: { status: "cancelled" } }),
        prisma.report.updateMany({ where: { listingId, status: "open" }, data: done }),
      ]);
      for (const b of new Set(active.map((c) => c.bulkClaimId).filter((x): x is string => !!x))) await recomputeBulk(b);
    } else {
      await prisma.report.update({ where: { id }, data: done });
    }
    res.json({ ok: true, action });
  }),
);

/** Early-access sign-ups: totals by role and by source over all rows, plus the latest 20. */
admin.get(
  "/early-access",
  ah(async (_req, res) => {
    const [total, byRole, bySource, latest] = await Promise.all([
      prisma.earlyAccessSignup.count(),
      prisma.earlyAccessSignup.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.earlyAccessSignup.groupBy({ by: ["source"], _count: { _all: true } }),
      prisma.earlyAccessSignup.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    const sorted = <T extends { _count: { _all: number } }>(xs: T[]) => [...xs].sort((a, b) => b._count._all - a._count._all);
    res.json({
      total,
      byRole: sorted(byRole).map((r) => ({ role: r.role, count: r._count._all })),
      bySource: sorted(bySource).map((r) => ({ source: r.source ?? "unknown", count: r._count._all })),
      latest,
    });
  }),
);

const csvCell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
  // Quote everything; neutralise leading formula characters so spreadsheets don't execute them.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** All early-access sign-ups as CSV (for the launch mail-out). Admin only, never cached. */
admin.get(
  "/early-access.csv",
  ah(async (_req, res) => {
    const rows = await prisma.earlyAccessSignup.findMany({ orderBy: { createdAt: "asc" } });
    const cols = ["email", "role", "postcode", "source", "language", "consentAt", "createdAt"] as const;
    const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="freshshare-early-access.csv"');
    res.setHeader("Cache-Control", "no-store");
    res.send(lines.join("\n") + "\n");
  }),
);
