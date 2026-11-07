import type { OrgRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { isAdmin, requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { distanceM, roundDistance } from "../lib/geo.js";
import { prisma } from "../lib/prisma.js";
import { offerToNext } from "../services/waitlist.js";
import { notify } from "../services/notify.js";
import { docUpload, sniffDoc } from "../lib/upload.js";
import { HOLD_MINUTES } from "../services/claims.js";
import { findNearby } from "../services/listings.js";
import { ALL_ROLES, CAN_BULK_CLAIM, CAN_COLLECT, recomputeBulk, requireOrgRole } from "../services/orgs.js";

export const organizations = Router();
export const bulkClaims = Router();

const ORG_TYPES = ["food_bank", "ngo", "charity", "community_center", "religious_org", "other"] as const;
const idParam = z.string().min(1).max(40);

const publicOrg = (o: {
  id: string; name: string; type: string; website: string | null; email: string; city: string; address: string; lat: number; lng: number;
  description: string; mission: string | null; serviceArea: string | null; logoUrl: string | null; status: string; verifiedAt: Date | null;
}) => ({
  id: o.id, name: o.name, type: o.type, website: o.website, email: o.email, city: o.city, address: o.address, lat: o.lat, lng: o.lng,
  description: o.description, mission: o.mission, serviceArea: o.serviceArea, logoUrl: o.logoUrl, status: o.status, verified: !!o.verifiedAt,
});

/** Directory: approved organizations only. */
organizations.get(
  "/",
  ah(async (_req, res) => {
    const rows = await prisma.organization.findMany({ where: { status: "approved" }, orderBy: { name: "asc" } });
    res.json({ organizations: rows.map(publicOrg) });
  }),
);

/** My memberships (any status), for the header and dashboards. */
organizations.get(
  "/mine/all",
  requireAuth,
  ah(async (req, res) => {
    const rows = await prisma.organizationMember.findMany({ where: { userId: userId(req) }, include: { organization: true } });
    res.json({ memberships: rows.map((m) => ({ role: m.role, organization: publicOrg(m.organization) })) });
  }),
);

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const registerBody = z.object({
  name: z.string().trim().min(3, "Please enter the organization's name").max(100),
  type: z.enum(ORG_TYPES, { errorMap: () => ({ message: "Please pick a type" }) }),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), "Website must start with http:// or https://"),
  address: z.string().trim().min(5, "Please enter the address").max(160),
  city: z.string().trim().min(2, "Please enter the city").max(80),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  description: z.string().trim().min(10, "Tell people a little about what you do").max(1000),
  mission: optional(500),
  serviceArea: optional(200),
  contactName: z.string().trim().min(2, "Who should we contact?").max(80),
  registrationNumber: optional(60),
});

/** Register an organization: saved as pending, the creator becomes its admin. */
organizations.post(
  "/",
  requireAuth,
  docUpload.single("document"),
  ah(async (req, res) => {
    const b = registerBody.parse(req.body);
    const me = userId(req);
    const doc = req.file;
    if (doc && sniffDoc(doc.buffer) === null) throw new HttpError(400, "unsupported_type", "Documents must be PDF, JPG or PNG");
    const org = await prisma.organization.create({
      data: {
        ...b,
        createdById: me,
        members: { create: { userId: me, role: "admin" } },
        ...(doc
          ? { documents: { create: { filename: doc.originalname.slice(0, 120), contentType: sniffDoc(doc.buffer)!, size: doc.size, data: doc.buffer } } }
          : {}),
      },
    });
    res.status(201).json({ organization: { id: org.id, status: org.status }, message: "Thanks! We'll review your organization and let you know." });
  }),
);

async function canSeeOrg(org: { id: string; status: string }, viewer: string | undefined) {
  if (org.status === "approved") return true;
  if (!viewer) return false;
  if (await isAdmin(viewer)) return true;
  return !!(await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: org.id, userId: viewer } } }));
}

organizations.get(
  "/:id",
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org || !(await canSeeOrg(org, req.user?.id))) throw new HttpError(404, "not_found", "Organization not found");
    const membership = req.user
      ? await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: id, userId: req.user.id } } })
      : null;
    res.json({ organization: { ...publicOrg(org), myRole: membership?.role ?? null } });
  }),
);

/** Verification documents: streamed only to site admins and this org's admins. No public or presigned links. */
organizations.get(
  "/:id/documents/:docId",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const docId = idParam.parse(req.params.docId);
    const me = userId(req);
    if (!(await isAdmin(me))) await requireOrgRole(id, me, ["admin"]);
    const doc = await prisma.organizationDocument.findFirst({ where: { id: docId, organizationId: id } });
    if (!doc) throw new HttpError(404, "not_found", "Document not found");
    res.set({
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${doc.filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(Buffer.from(doc.data));
  }),
);

/** Dashboard for members: team, items collected, bulk claims, documents (org admins). */
organizations.get(
  "/:id/dashboard",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const m = await requireOrgRole(id, userId(req));
    const [members, bulk, collected, docs] = await Promise.all([
      prisma.organizationMember.findMany({ where: { organizationId: id }, orderBy: { joinedAt: "asc" } }),
      prisma.bulkClaim.findMany({ where: { organizationId: id }, orderBy: { createdAt: "desc" }, include: { items: true }, take: 50 }),
      prisma.bulkClaimItem.count({ where: { isCollected: true, bulkClaim: { organizationId: id } } }),
      m.role === "admin" ? prisma.organizationDocument.findMany({ where: { organizationId: id }, select: { id: true, filename: true, contentType: true, size: true } }) : [],
    ]);
    const users = await prisma.user.findMany({ where: { id: { in: members.map((x) => x.userId) } }, select: { id: true, name: true, email: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    res.json({
      organization: { ...publicOrg(m.organization), myRole: m.role },
      members: members.map((x) => ({
        userId: x.userId,
        name: byId.get(x.userId)?.name ?? "Unknown",
        // Emails are only shown to org admins, who manage the team.
        email: m.role === "admin" ? byId.get(x.userId)?.email : undefined,
        role: x.role,
        joinedAt: x.joinedAt,
      })),
      itemsCollected: collected,
      bulkClaims: bulk.map((b) => ({
        id: b.id, name: b.name, status: b.status, scheduledPickupDate: b.scheduledPickupDate, items: b.items.length,
        collected: b.items.filter((i) => i.isCollected).length,
      })),
      documents: docs,
    });
  }),
);

const inviteBody = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  role: z.enum(ALL_ROLES as [OrgRole, ...OrgRole[]]),
});

/** Invite an existing FreshShare user by email (org admins only). */
organizations.post(
  "/:id/members",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    await requireOrgRole(id, userId(req), ["admin"]);
    const b = inviteBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: b.email } });
    if (!user) throw new HttpError(404, "no_such_user", "No FreshShare account uses that email. Ask them to sign up first.");
    const exists = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: id, userId: user.id } } });
    if (exists) throw new HttpError(409, "already_member", `${user.name} is already on the team`);
    await prisma.organizationMember.create({ data: { organizationId: id, userId: user.id, role: b.role } });
    res.status(201).json({ ok: true, message: `${user.name} joined as ${b.role}` });
  }),
);

async function guardLastAdmin(orgId: string, targetUserId: string) {
  const target = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } } });
  if (!target) throw new HttpError(404, "not_found", "Not on this team");
  if (target.role === "admin" && (await prisma.organizationMember.count({ where: { organizationId: orgId, role: "admin" } })) <= 1) {
    throw new HttpError(409, "last_admin", "Every organization needs at least one admin");
  }
  return target;
}

organizations.patch(
  "/:id/members/:userId",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const target = idParam.parse(req.params.userId);
    await requireOrgRole(id, userId(req), ["admin"]);
    const { role } = z.object({ role: z.enum(ALL_ROLES as [OrgRole, ...OrgRole[]]) }).parse(req.body);
    if (role !== "admin") await guardLastAdmin(id, target);
    await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: id, userId: target } }, data: { role } });
    res.json({ ok: true });
  }),
);

organizations.delete(
  "/:id/members/:userId",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const target = idParam.parse(req.params.userId);
    await requireOrgRole(id, userId(req), ["admin"]);
    await guardLastAdmin(id, target);
    await prisma.organizationMember.delete({ where: { organizationId_userId: { organizationId: id, userId: target } } });
    res.status(204).end();
  }),
);

const candidatesQuery = z.object({ radius: z.coerce.number().int().min(500).max(20000).default(5000) });

/** Listings a bulk claim can pick from: available, near the org, not posted by its own members. */
organizations.get(
  "/:id/candidates",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const m = await requireOrgRole(id, userId(req), CAN_BULK_CLAIM);
    const { radius } = candidatesQuery.parse(req.query);
    const memberIds = new Set((await prisma.organizationMember.findMany({ where: { organizationId: id }, select: { userId: true } })).map((x) => x.userId));
    const nearby = await findNearby(m.organization.lat, m.organization.lng, radius);
    res.json({ listings: nearby.filter((l) => !memberIds.has(l.giver.id)) });
  }),
);

const bulkBody = z.object({
  name: z.string().trim().min(3, "Give the pickup run a name").max(80),
  notes: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
  scheduledPickupDate: z.coerce.date({ errorMap: () => ({ message: "Pick a pickup date" }) }),
  listingIds: z.array(z.string().min(1).max(40)).min(1, "Pick at least one listing").max(30),
});

/**
 * Bulk claim: one named pickup run, one pending claim per picked listing. Each listing is reserved with the
 * same atomic available -> reserved guard as a normal claim; ones someone else got first are reported back.
 */
organizations.post(
  "/:id/bulk-claims",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const me = userId(req);
    await requireOrgRole(id, me, CAN_BULK_CLAIM, { approved: true });
    const b = bulkBody.parse(req.body);
    const ids = [...new Set(b.listingIds)];
    const memberIds = (await prisma.organizationMember.findMany({ where: { organizationId: id }, select: { userId: true } })).map((x) => x.userId);
    const bulk = await prisma.bulkClaim.create({ data: { organizationId: id, createdById: me, name: b.name, notes: b.notes, scheduledPickupDate: b.scheduledPickupDate } });
    const taken: string[] = [];
    for (const listingId of ids) {
      const ok = await prisma.$transaction(async (tx) => {
        const l = await tx.listing.findUnique({ where: { id: listingId } });
        if (!l || memberIds.includes(l.giverId)) return false;
        const now = new Date();
        const flipped = await tx.listing.updateMany({
          where: { id: listingId, status: "available", bestBefore: { gt: now }, OR: [{ reservedForUserId: null }, { reservedUntil: { lt: now } }] },
          data: { status: "reserved", reservedForUserId: null, reservedUntil: null },
        });
        if (flipped.count === 0) return false;
        // Givers confirm bulk requests as usual; hold them until the listing's pickup window ends.
        const holdUntil = new Date(Math.max(Date.now() + HOLD_MINUTES * 60_000, l.pickupUntil.getTime()));
        const claim = await tx.claim.create({ data: { listingId, receiverId: me, organizationId: id, bulkClaimId: bulk.id, holdUntil } });
        await tx.bulkClaimItem.create({ data: { bulkClaimId: bulk.id, listingId, claimId: claim.id } });
        return { giverId: l.giverId, title: l.title, claimId: claim.id };
      });
      if (!ok) taken.push(listingId);
      else {
        const org = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
        await notify(ok.giverId, {
          type: "claim_received",
          title: `${org?.name ?? "An organization"} would like your ${ok.title}`,
          body: "Confirm the request on the pickup page. Your exact address is shared only after you confirm.",
          link: `/pickups/${ok.claimId}`,
          listingId,
          claimId: ok.claimId,
        });
      }
    }
    if (taken.length === ids.length) {
      await prisma.bulkClaim.delete({ where: { id: bulk.id } });
      throw new HttpError(409, "not_available", "Someone else was quicker. None of those listings are still available.");
    }
    res.status(201).json({ bulkClaim: { id: bulk.id }, skipped: taken });
  }),
);

async function loadBulk(id: string, viewer: string) {
  const bulk = await prisma.bulkClaim.findUnique({
    where: { id },
    include: { items: { include: { claim: { include: { listing: { include: { giver: true } } } } } }, organization: true },
  });
  if (!bulk) throw new HttpError(404, "not_found", "Not found");
  const m = await requireOrgRole(bulk.organizationId, viewer);
  return { bulk, role: m.role };
}

const bulkView = (bulk: Awaited<ReturnType<typeof loadBulk>>["bulk"], role: OrgRole, origin: { lat: number; lng: number }) => ({
  id: bulk.id,
  name: bulk.name,
  notes: bulk.notes,
  status: bulk.status,
  scheduledPickupDate: bulk.scheduledPickupDate,
  organization: { id: bulk.organization.id, name: bulk.organization.name },
  myRole: role,
  items: bulk.items.map((i) => {
    const l = i.claim.listing;
    const confirmed = i.claim.status === "confirmed" || i.claim.status === "collected";
    return {
      id: i.id,
      claimId: i.claimId,
      claimStatus: i.claim.status,
      isCollected: i.isCollected,
      collectedAt: i.collectedAt,
      listing: {
        id: l.id, title: l.title, photoUrl: l.photoUrl, portions: l.portions, pickupUntil: l.pickupUntil,
        giver: { id: l.giver.id, name: l.giver.name },
        distanceM: roundDistance(distanceM(origin.lat, origin.lng, l.publicLat, l.publicLng)),
        // Exact pickup spot only once the giver confirmed, as for any claim.
        ...(confirmed ? { lat: l.lat, lng: l.lng, handoverSpot: l.handoverSpot, pickupInstructions: l.pickupInstructions } : {}),
      },
    };
  }),
});

bulkClaims.get(
  "/:id",
  requireAuth,
  ah(async (req, res) => {
    const { bulk, role } = await loadBulk(idParam.parse(req.params.id), userId(req));
    res.json({ bulkClaim: bulkView(bulk, role, bulk.organization) });
  }),
);

/** Volunteers (and managers/admins) tick a confirmed item as collected, which completes that claim. */
bulkClaims.post(
  "/:id/items/:itemId/collect",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const itemId = idParam.parse(req.params.itemId);
    const me = userId(req);
    const { bulk } = await loadBulk(id, me);
    await requireOrgRole(bulk.organizationId, me, CAN_COLLECT);
    const item = bulk.items.find((i) => i.id === itemId);
    if (!item) throw new HttpError(404, "not_found", "Not found");
    if (item.claim.status !== "confirmed") throw new HttpError(409, "bad_state", "The giver has to confirm this item before it can be collected");
    const now = new Date();
    await prisma.$transaction([
      prisma.claim.update({ where: { id: item.claimId }, data: { status: "collected" } }),
      prisma.listing.update({ where: { id: item.listingId }, data: { status: "collected" } }),
      prisma.bulkClaimItem.update({ where: { id: itemId }, data: { isCollected: true, collectedAt: now } }),
    ]);
    await recomputeBulk(id);
    const again = await loadBulk(id, me);
    res.json({ bulkClaim: bulkView(again.bulk, again.role, again.bulk.organization) });
  }),
);

/** Cancel the whole run (admins/managers): every still-active claim is cancelled and its listing reopened. */
bulkClaims.post(
  "/:id/cancel",
  requireAuth,
  ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const me = userId(req);
    const { bulk } = await loadBulk(id, me);
    await requireOrgRole(bulk.organizationId, me, CAN_BULK_CLAIM);
    for (const i of bulk.items.filter((x) => x.claim.status === "pending" || x.claim.status === "confirmed")) {
      await prisma.$transaction([
        prisma.claim.update({ where: { id: i.claimId }, data: { status: "cancelled" } }),
        prisma.listing.updateMany({ where: { id: i.listingId, status: "reserved" }, data: { status: "available" } }),
      ]);
      await offerToNext(i.listingId);
    }
    await recomputeBulk(id);
    const again = await loadBulk(id, me);
    res.json({ bulkClaim: bulkView(again.bulk, again.role, again.bulk.organization) });
  }),
);
