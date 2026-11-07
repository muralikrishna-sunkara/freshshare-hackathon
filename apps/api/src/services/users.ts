import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function meView(u: User) {
  const [shared, given, received] = await Promise.all([
    prisma.listing.count({ where: { giverId: u.id, status: { not: "removed" } } }),
    prisma.claim.count({ where: { listing: { giverId: u.id }, status: "collected" } }),
    prisma.claim.count({ where: { receiverId: u.id, status: "collected" } }),
  ]);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    homeLat: u.homeLat,
    homeLng: u.homeLng,
    bio: u.bio,
    role: u.role,
    emailNotifications: u.emailNotifications,
    termsVersion: u.termsVersion,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    verified: u.emailVerified && u.phoneVerified,
    ratingAvg: Math.round(u.ratingAvg * 10) / 10,
    ratingCount: u.ratingCount,
    stats: { shared, given, received },
  };
}
