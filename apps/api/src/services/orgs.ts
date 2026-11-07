import type { OrgRole, Prisma } from "@prisma/client";
import { HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export const ALL_ROLES: OrgRole[] = ["admin", "manager", "volunteer", "viewer"];
export const CAN_BULK_CLAIM: OrgRole[] = ["admin", "manager"];
export const CAN_COLLECT: OrgRole[] = ["admin", "manager", "volunteer"];

/**
 * Org permission check used by every org action. Anyone without one of `roles` gets 404, so a
 * non-member or a viewer can't even tell that the form or data exists.
 */
export async function requireOrgRole(orgId: string, userId: string | undefined, roles: OrgRole[] = ALL_ROLES, opts: { approved?: boolean } = {}) {
  if (!userId) throw new HttpError(404, "not_found", "Not found");
  const m = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    include: { organization: true },
  });
  if (!m || !roles.includes(m.role)) throw new HttpError(404, "not_found", "Not found");
  if (opts.approved && m.organization.status !== "approved") {
    throw new HttpError(409, "org_not_approved", "Your organization needs to be approved first");
  }
  return m;
}

type ItemWithClaim = Prisma.BulkClaimItemGetPayload<{ include: { claim: true } }>;

/** pending -> in_progress (first item confirmed) -> partially_completed -> completed; cancelled when nothing is left. */
export function bulkStatus(items: ItemWithClaim[]) {
  const live = items.filter((i) => !["cancelled", "declined", "lapsed"].includes(i.claim.status));
  const collected = items.filter((i) => i.claim.status === "collected").length;
  if (live.length === 0) return "cancelled" as const;
  if (collected === live.length) return "completed" as const;
  if (collected > 0) return "partially_completed" as const;
  if (live.some((i) => i.claim.status === "confirmed")) return "in_progress" as const;
  return "pending" as const;
}

export async function recomputeBulk(bulkClaimId: string) {
  const items = await prisma.bulkClaimItem.findMany({ where: { bulkClaimId }, include: { claim: true } });
  const status = bulkStatus(items);
  await prisma.bulkClaim.update({
    where: { id: bulkClaimId },
    data: { status, completedAt: status === "completed" ? new Date() : null },
  });
  return status;
}
