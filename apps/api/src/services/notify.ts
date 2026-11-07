import type { NotificationType } from "@prisma/client";
import { renderEmail, sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { TEST_EMAIL_SUFFIX } from "./rules.js";

/** Types that also go out by email (when the user has email notifications on). */
export const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set(["claim_received", "claim_confirmed", "new_message"]);
/** At most one new_message email per pickup in this window, so a chat doesn't flood the inbox. */
export const MESSAGE_EMAIL_COOLDOWN_MS = 10 * 60_000;

const CTA: Partial<Record<NotificationType, string>> = {
  claim_received: "Confirm or decline",
  claim_confirmed: "See pickup details",
  new_message: "Reply",
};

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  listingId?: string;
  claimId?: string;
}

/**
 * Records an in-app notification (the bell picks it up within a few seconds) and, for claim and message
 * events, emails the user. Never throws: a notification problem must not fail the action that caused it.
 */
export async function notify(userId: string, n: NotifyInput) {
  try {
    const row = await prisma.notification.create({
      data: { userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null, listingId: n.listingId ?? null, claimId: n.claimId ?? null },
    });
    if (EMAIL_TYPES.has(n.type)) await maybeEmail(row.id, userId, n);
    return row;
  } catch (err) {
    logger.error({ err, type: n.type }, "notify failed");
    return null;
  }
}

async function maybeEmail(notificationId: string, userId: string, n: NotifyInput) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailNotifications: true } });
  if (!user?.emailNotifications) return;
  // Fictional demo and test accounts never get real mail.
  if (user.email.endsWith(TEST_EMAIL_SUFFIX) && process.env.NODE_ENV === "production") return;
  if (user.email.endsWith("@demo.freshshare.de") && process.env.NODE_ENV === "production") return;
  if (n.type === "new_message" && n.claimId) {
    const recent = await prisma.notification.findFirst({
      where: { userId, claimId: n.claimId, type: "new_message", emailedAt: { gt: new Date(Date.now() - MESSAGE_EMAIL_COOLDOWN_MS) } },
      select: { id: true },
    });
    if (recent) return;
  }
  const { text, html } = renderEmail({ title: n.title, body: n.body, link: n.link, cta: CTA[n.type] });
  if (await sendEmail({ to: user.email, subject: n.title, text, html })) {
    await prisma.notification.update({ where: { id: notificationId }, data: { emailedAt: new Date() } });
  }
}

/** Fire-and-forget variant for request handlers. */
export function notifyLater(userId: string, n: NotifyInput) {
  void notify(userId, n);
}

/** At most one new_listing_nearby alert per person in this window. */
export const NEARBY_ALERT_COOLDOWN_MS = 20 * 60_000;

/** Tell people whose alert area covers a new listing (matching category), except the giver. */
export async function notifyNearby(l: { id: string; giverId: string; title: string; category: import("@prisma/client").Category; publicLat: number; publicLng: number; areaName: string | null }) {
  try {
    const { distanceM } = await import("../lib/geo.js");
    const subs = await prisma.alertSubscription.findMany({ where: { userId: { not: l.giverId } }, take: 500 });
    const hits = subs.filter((s) => (s.categories.length === 0 || s.categories.includes(l.category)) && distanceM(s.lat, s.lng, l.publicLat, l.publicLng) <= s.radiusM);
    const userIds = [...new Set(hits.map((s) => s.userId))];
    if (!userIds.length) return 0;
    const recent = new Set(
      (
        await prisma.notification.findMany({
          where: { userId: { in: userIds }, type: "new_listing_nearby", createdAt: { gt: new Date(Date.now() - NEARBY_ALERT_COOLDOWN_MS) } },
          select: { userId: true },
        })
      ).map((n) => n.userId),
    );
    let sent = 0;
    for (const userId of userIds.filter((u) => !recent.has(u))) {
      const s = hits.find((h) => h.userId === userId)!;
      const m = Math.round(distanceM(s.lat, s.lng, l.publicLat, l.publicLng) / 50) * 50;
      await notify(userId, {
        type: "new_listing_nearby",
        title: `New near you: ${l.title}`,
        body: `About ${m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`} away${l.areaName ? ` in ${l.areaName}` : ""}.`,
        link: `/listings/${l.id}`,
        listingId: l.id,
      });
      sent++;
    }
    return sent;
  } catch (err) {
    logger.error({ err }, "nearby alerts failed");
    return 0;
  }
}
