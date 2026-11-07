import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Category, ClaimStatus, FridgeKind, FridgeState, ListingStatus, Origin, OrgRole, OrgStatus, OrgType, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { jitter, mulberry32 } from "../lib/geo.js";
import type { Storage } from "../lib/storage.js";
import { TERMS_VERSION } from "./rules.js";

interface SeedFile {
  demoPassword: string;
  mapCentre: { lat: number; lng: number };
  users: { key: string; name: string; email: string; homeLat: number; homeLng: number; emailVerified: boolean; phoneVerified: boolean; ratingAvg: number; ratingCount: number; role?: UserRole; bio?: string }[];
  listings: {
    key: string; giver: string; title: string; description?: string; category: Category; origin: Origin; allergens: string[];
    bestBeforeOffsetMin: number; createdOffsetMin: number; pickupFromOffsetMin: number; pickupUntilOffsetMin: number;
    portions: number; photo: string; handoverSpot: string | null; status: ListingStatus;
  }[];
  claims: {
    listing: string; receiver: string; status: ClaimStatus; createdOffsetMin: number; holdMinutes?: number;
    messages?: { from: string; offsetMin: number; body: string }[];
    ratings?: { from: string; to: string; stars: number; note?: string }[];
  }[];
  fridges: { key: string; name: string; address: string; lat: number; lng: number; openingHours: string; photo?: string; lastCheckIn?: { state: FridgeState; by: string; offsetMin: number } }[];
  alertSubscriptions: { user: string; lat: number; lng: number; radiusM: number; categories: Category[] }[];
  impactBaseline?: { portionsThisWeek: number };
  organizations?: {
    key: string; name: string; type: OrgType; email: string; website?: string; address: string; city: string; lat: number; lng: number;
    description: string; mission?: string; serviceArea?: string; contactName: string; status: OrgStatus; members: { user: string; role: OrgRole }[];
  }[];
  pendingFridges?: { key: string; name: string; kind: FridgeKind; address: string; lat: number; lng: number; openingHours: string; description?: string; accessNotes?: string; suggestedBy: string }[];
}

export function findSeedDir(): string {
  const candidates = [
    process.env.SEED_DATA_DIR,
    path.resolve(process.cwd(), "data"),
    path.resolve(process.cwd(), "../../data"),
    "/app/data",
  ].filter((p): p is string => !!p);
  const dir = candidates.find((d) => existsSync(path.join(d, "seed.json")));
  if (!dir) throw new Error(`seed.json not found in ${candidates.join(", ")} (set SEED_DATA_DIR)`);
  return dir;
}

export interface SeedResult {
  dir: string;
  users: Record<string, string>;
  listings: Record<string, string>;
  fridges: Record<string, string>;
  organizations: Record<string, string>;
  now: Date;
}

/** FULL RESET of the demo database, then load data/seed.json and upload photos via storage. */
export async function runSeed(prisma: PrismaClient, storage: Storage, opts: { dir?: string; log?: (m: string) => void; bcryptCost?: number } = {}): Promise<SeedResult> {
  const log = opts.log ?? (() => {});
  const dir = opts.dir ?? findSeedDir();
  const seed = JSON.parse(await readFile(path.join(dir, "seed.json"), "utf8")) as SeedFile;
  const now = new Date();
  const at = (offsetMin: number) => new Date(now.getTime() + offsetMin * 60_000);
  const rand = mulberry32(20261107);

  // Delete in dependency order.
  await prisma.$transaction([
    prisma.earlyAccessSignup.deleteMany(),
    prisma.report.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.alertSubscription.deleteMany(),
    prisma.bulkClaimItem.deleteMany(),
    prisma.bulkClaim.deleteMany(),
    prisma.organizationDocument.deleteMany(),
    prisma.organizationMember.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.fridgeCheckIn.deleteMany(),
    prisma.rating.deleteMany(),
    prisma.message.deleteMany(),
    prisma.claim.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.fridge.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  log("cleared all tables");

  const passwordHash = await bcrypt.hash(seed.demoPassword, opts.bcryptCost ?? 12);
  const users: Record<string, string> = {};
  const homes: Record<string, { lat: number; lng: number }> = {};
  for (const u of seed.users) {
    const row = await prisma.user.create({
      data: {
        email: u.email, name: u.name, passwordHash, homeLat: u.homeLat, homeLng: u.homeLng,
        emailVerified: u.emailVerified, phoneVerified: u.phoneVerified, ratingAvg: u.ratingAvg, ratingCount: u.ratingCount,
        termsAcceptedAt: now, termsVersion: TERMS_VERSION, role: u.role ?? "user", bio: u.bio ?? null,
      },
    });
    users[u.key] = row.id;
    homes[u.key] = { lat: u.homeLat, lng: u.homeLng };
  }
  log(`users: ${seed.users.length}`);

  const toWebp = async (file: string) =>
    sharp(await readFile(path.join(dir, "seed-photos", file))).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();

  const listings: Record<string, string> = {};
  for (const l of seed.listings) {
    const home = homes[l.giver];
    const pub = jitter(home.lat, home.lng, rand);
    const row = await prisma.listing.create({
      data: {
        giverId: users[l.giver], title: l.title, description: l.description ?? null, category: l.category, origin: l.origin,
        allergens: l.allergens, bestBefore: at(l.bestBeforeOffsetMin), photoUrl: "", lat: home.lat, lng: home.lng,
        publicLat: pub.lat, publicLng: pub.lng, handoverSpot: l.handoverSpot, pickupFrom: at(l.pickupFromOffsetMin),
        pickupUntil: at(l.pickupUntilOffsetMin), portions: l.portions, status: l.status, createdAt: at(l.createdOffsetMin),
      },
    });
    const photoUrl = await storage.put(`listings/${row.id}.webp`, await toWebp(l.photo), "image/webp");
    await prisma.listing.update({ where: { id: row.id }, data: { photoUrl } });
    listings[l.key] = row.id;
  }
  log(`listings: ${seed.listings.length} (photos uploaded)`);

  const ratedUsers = new Set<string>();
  for (const c of seed.claims) {
    const createdAt = at(c.createdOffsetMin);
    const claim = await prisma.claim.create({
      data: {
        listingId: listings[c.listing], receiverId: users[c.receiver], status: c.status, createdAt,
        holdUntil: new Date(createdAt.getTime() + (c.holdMinutes ?? 30) * 60_000),
      },
    });
    for (const m of c.messages ?? []) {
      await prisma.message.create({ data: { claimId: claim.id, senderId: users[m.from], body: m.body, createdAt: at(m.offsetMin) } });
    }
    for (const r of c.ratings ?? []) {
      await prisma.rating.create({ data: { claimId: claim.id, fromUserId: users[r.from], toUserId: users[r.to], stars: r.stars, note: r.note ?? null } });
      ratedUsers.add(r.to);
    }
  }
  log(`claims: ${seed.claims.length}`);

  // The file's ratingAvg/ratingCount are each user's history (they already include the seeded ratings),
  // so only users who start at 0 ratings are recomputed from the seeded Rating rows.
  for (const key of ratedUsers) {
    const fileUser = seed.users.find((u) => u.key === key);
    if (fileUser && fileUser.ratingCount > 0) continue;
    const agg = await prisma.rating.aggregate({ where: { toUserId: users[key] }, _avg: { stars: true }, _count: true });
    await prisma.user.update({ where: { id: users[key] }, data: { ratingAvg: agg._avg.stars ?? 0, ratingCount: agg._count } });
  }

  const fridges: Record<string, string> = {};
  for (const f of seed.fridges) {
    const row = await prisma.fridge.create({ data: { name: f.name, address: f.address, lat: f.lat, lng: f.lng, openingHours: f.openingHours } });
    if (f.photo) {
      const photoUrl = await storage.put(`fridges/${row.id}.webp`, await toWebp(f.photo), "image/webp");
      await prisma.fridge.update({ where: { id: row.id }, data: { photoUrl } });
    }
    if (f.lastCheckIn) {
      await prisma.fridgeCheckIn.create({
        data: { fridgeId: row.id, userId: users[f.lastCheckIn.by], state: f.lastCheckIn.state, createdAt: at(f.lastCheckIn.offsetMin) },
      });
    }
    fridges[f.key] = row.id;
  }
  log(`fridges: ${seed.fridges.length}`);

  for (const f of seed.pendingFridges ?? []) {
    const row = await prisma.fridge.create({
      data: {
        name: f.name, kind: f.kind, address: f.address, lat: f.lat, lng: f.lng, openingHours: f.openingHours,
        description: f.description ?? null, accessNotes: f.accessNotes ?? null, status: "pending", createdById: users[f.suggestedBy],
      },
    });
    fridges[f.key] = row.id;
  }

  const organizations: Record<string, string> = {};
  for (const o of seed.organizations ?? []) {
    const row = await prisma.organization.create({
      data: {
        name: o.name, type: o.type, email: o.email, website: o.website ?? null, address: o.address, city: o.city, lat: o.lat, lng: o.lng,
        description: o.description, mission: o.mission ?? null, serviceArea: o.serviceArea ?? null, contactName: o.contactName, status: o.status,
        createdById: users[o.members.find((m) => m.role === "admin")!.user],
        ...(o.status === "approved" ? { verifiedAt: now, verifiedById: users.admin ?? null } : {}),
        members: { create: o.members.map((m) => ({ userId: users[m.user], role: m.role })) },
      },
    });
    organizations[o.key] = row.id;
  }
  log(`organizations: ${(seed.organizations ?? []).length}, pending fridges: ${(seed.pendingFridges ?? []).length}`);

  for (const a of seed.alertSubscriptions) {
    await prisma.alertSubscription.create({ data: { userId: users[a.user], lat: a.lat, lng: a.lng, radiusM: a.radiusM, categories: a.categories } });
  }
  await prisma.setting.create({ data: { key: "impactBaselinePortions", value: String(seed.impactBaseline?.portionsThisWeek ?? 0) } });
  log("alerts and settings done");

  return { dir, users, listings, fridges, organizations, now };
}
