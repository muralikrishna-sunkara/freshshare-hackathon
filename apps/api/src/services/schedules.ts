import type { ListingSchedule } from "@prisma/client";
import { reverseArea } from "../lib/geocode.js";
import { jitter } from "../lib/geo.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { notifyNearby } from "./notify.js";

const TZ = "Europe/Berlin";

/** Weekday (0 = Sunday), date "YYYY-MM-DD" and time "HH:MM" in Berlin. */
export function berlinParts(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { weekday, date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export const isDue = (s: Pick<ListingSchedule, "active" | "daysOfWeek" | "time" | "lastPostedOn">, now: Date) => {
  const b = berlinParts(now);
  return s.active && s.daysOfWeek.includes(b.weekday) && b.time >= s.time && s.lastPostedOn !== b.date;
};

/** Next time this schedule will post, for the UI. */
export function nextRun(s: Pick<ListingSchedule, "active" | "daysOfWeek" | "time" | "lastPostedOn">, now = new Date()): string | null {
  if (!s.active || s.daysOfWeek.length === 0) return null;
  for (let d = 0; d < 8; d++) {
    const day = new Date(now.getTime() + d * 86_400_000);
    const b = berlinParts(day);
    if (!s.daysOfWeek.includes(b.weekday)) continue;
    if (d === 0 && s.lastPostedOn === b.date) continue;
    return `${b.date} ${s.time}`;
  }
  return null;
}

/** Posts one listing from a schedule (the giver's home, jittered, like a normal post). */
export async function postFromSchedule(s: ListingSchedule, now = new Date()) {
  const giver = await prisma.user.findUnique({ where: { id: s.userId } });
  if (!giver || giver.suspendedAt) return null;
  const pub = jitter(giver.homeLat, giver.homeLng);
  const area = await reverseArea(giver.homeLat, giver.homeLng);
  const pickupUntil = new Date(now.getTime() + s.pickupHours * 3600_000);
  const bestBefore = new Date(Math.max(now.getTime() + s.bestBeforeDays * 86_400_000, pickupUntil.getTime() + 3600_000));
  const l = await prisma.listing.create({
    data: {
      giverId: s.userId, title: s.title, description: s.description, category: s.category, origin: s.origin, allergens: s.allergens,
      dietaryTags: s.dietaryTags, weightKg: s.weightKg, portions: s.portions, handoverSpot: s.handoverSpot,
      photoUrl: s.photos[0] ?? "", photos: s.photos, lat: giver.homeLat, lng: giver.homeLng, publicLat: pub.lat, publicLng: pub.lng,
      postcode: area.postcode, areaName: area.areaName, bestBefore, pickupFrom: now, pickupUntil, scheduleId: s.id,
    },
  });
  void notifyNearby(l);
  return l;
}

/**
 * Every minute: post today's listing for each due schedule. The lastPostedOn update is the lock, so with
 * several api tasks running housekeeping each schedule still posts once per day.
 */
export async function postDueSchedules(now = new Date()) {
  const today = berlinParts(now).date;
  const candidates = await prisma.listingSchedule.findMany({ where: { active: true, OR: [{ lastPostedOn: null }, { lastPostedOn: { not: today } }] } });
  let posted = 0;
  for (const s of candidates.filter((x) => isDue(x, now))) {
    const won = await prisma.listingSchedule.updateMany({ where: { id: s.id, OR: [{ lastPostedOn: null }, { lastPostedOn: { not: today } }] }, data: { lastPostedOn: today } });
    if (won.count === 0) continue;
    try {
      if (await postFromSchedule(s, now)) posted++;
    } catch (err) {
      logger.error({ err, scheduleId: s.id }, "recurring listing failed");
    }
  }
  return posted;
}
