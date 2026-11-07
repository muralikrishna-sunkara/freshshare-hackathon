import { Router } from "express";
import { z } from "zod";
import { requireAdmin, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

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
