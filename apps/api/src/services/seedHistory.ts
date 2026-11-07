import type { Category, EarlyAccessRole, FillLevel, FridgeKind, Origin, OrgRole, OrgType, PrismaClient, ReportReason } from "@prisma/client";
import { distanceM, jitter } from "../lib/geo.js";

/**
 * Eight weeks of believable demo history around the seed's map centre, so the landing stats, profiles,
 * fridges, organizations and the admin screens look alive. Fully deterministic (seeded PRNG), fictional
 * people only (@demo.freshshare.de). It never adds an available listing within 2.2 km of the centre, so the
 * hand-written pitch listings in data/seed.json stay the only food on the default 2 km map.
 */

export interface PhotoInfo {
  titles: string[];
  category: Category;
  origin: Origin;
  dietary: string[];
  allergens: string[];
  kg: [number, number];
  portions: [number, number];
}

const V = ["vegan", "vegetarian"];
const VG = ["vegan", "vegetarian", "gluten_free", "lactose_free", "nut_free"];

/** Kit photos with titles that match what they show. Left out because they are hard to read at card size: coconut milk, coffee, lentil soup, mint tea. */
export const PHOTOS: Record<string, PhotoInfo> = {
  "apples.jpg": { titles: ["Bag of apples from our tree", "Cooking apples, about 2 kg"], category: "fruit_veg", origin: "fresh_produce", dietary: VG, allergens: [], kg: [1, 3], portions: [4, 8] },
  "bananas.jpg": { titles: ["Ripe bananas, great for baking", "Bananas, a bit spotty"], category: "fruit_veg", origin: "fresh_produce", dietary: VG, allergens: [], kg: [0.5, 1.5], portions: [3, 6] },
  "bread.jpg": { titles: ["White sandwich loaf", "White bread, half a loaf"], category: "bread", origin: "packaged", dietary: V, allergens: ["gluten"], kg: [0.3, 0.6], portions: [2, 4] },
  "cheddar.jpg": { titles: ["Cheese, half a block", "Swiss-style cheese, 300 g"], category: "dairy", origin: "packaged", dietary: ["vegetarian", "gluten_free"], allergens: ["milk"], kg: [0.3, 0.5], portions: [2, 4] },
  "chicken.jpg": { titles: ["Roast chicken, cooked today", "Roast chicken leftovers, 2 portions"], category: "leftovers", origin: "homemade", dietary: ["gluten_free", "lactose_free"], allergens: [], kg: [0.6, 1.2], portions: [2, 3] },
  "chickpeas.jpg": { titles: ["Dried pulses, 500 g bag", "Dried green lentils, sealed bag"], category: "packaged", origin: "packaged", dietary: VG, allergens: [], kg: [0.5, 1], portions: [4, 6] },
  "croissants.jpg": { titles: ["Butter croissants from the bakery", "Croissants, end of day"], category: "bread", origin: "packaged", dietary: ["vegetarian"], allergens: ["gluten", "milk", "eggs"], kg: [0.3, 0.6], portions: [3, 6] },
  "granola.jpg": { titles: ["Overnight oats with fruit, 2 bowls", "Muesli bowls with banana and blueberries"], category: "leftovers", origin: "homemade", dietary: V, allergens: ["gluten"], kg: [0.4, 0.8], portions: [2, 2] },
  "hummus.jpg": { titles: ["Homemade hummus", "Hummus, a big bowl"], category: "leftovers", origin: "homemade", dietary: ["vegan", "vegetarian", "gluten_free", "lactose_free"], allergens: ["sesame"], kg: [0.3, 0.6], portions: [3, 5] },
  "lamb-stew.jpg": { titles: ["Lamb stew, 2 portions", "Lamb and potato stew"], category: "leftovers", origin: "homemade", dietary: ["halal", "gluten_free"], allergens: ["celery"], kg: [0.6, 1.2], portions: [2, 4] },
  "meatballs.jpg": { titles: ["Cooked meatballs in tomato sauce", "Meatballs, cooked, 3 portions"], category: "leftovers", origin: "homemade", dietary: [], allergens: ["gluten", "eggs"], kg: [0.5, 1], portions: [2, 4] },
  "oat-drink.jpg": { titles: ["Oat drink, 1 litre, unopened", "Oat drink, 2 cartons"], category: "dairy", origin: "packaged", dietary: ["vegan", "vegetarian", "lactose_free", "nut_free"], allergens: ["gluten"], kg: [1, 2], portions: [4, 8] },
  "orange-juice.jpg": { titles: ["Orange juice, 1 litre", "Fresh orange juice, 2 bottles"], category: "packaged", origin: "packaged", dietary: VG, allergens: [], kg: [1, 2], portions: [4, 8] },
  "pasta.jpg": { titles: ["Vegetable lasagne, 4 portions", "Pasta bake leftovers"], category: "leftovers", origin: "homemade", dietary: ["vegetarian"], allergens: ["gluten", "milk"], kg: [0.8, 1.6], portions: [2, 4] },
  "rolls.jpg": { titles: ["Bread rolls from this morning", "Six bread rolls"], category: "bread", origin: "packaged", dietary: V, allergens: ["gluten"], kg: [0.3, 0.6], portions: [3, 6] },
  "salad.jpg": { titles: ["Romaine lettuce from the garden", "Lettuce heads, 3 pieces"], category: "fruit_veg", origin: "fresh_produce", dietary: VG, allergens: [], kg: [0.3, 1], portions: [2, 4] },
  "sourdough.jpg": { titles: ["Sourdough loaf, baked yesterday", "Half a sourdough loaf"], category: "bread", origin: "homemade", dietary: V, allergens: ["gluten"], kg: [0.4, 1], portions: [3, 6] },
  "sweetcorn.jpg": { titles: ["Sweetcorn tins, unopened", "Sweetcorn, 3 tins"], category: "packaged", origin: "packaged", dietary: VG, allergens: [], kg: [0.4, 1.2], portions: [2, 6] },
  "tinned-tomatoes.jpg": { titles: ["Ripe tomatoes from the garden", "Tomatoes, about 1 kg"], category: "fruit_veg", origin: "fresh_produce", dietary: VG, allergens: [], kg: [0.5, 1.5], portions: [3, 6] },
  "turkey.jpg": { titles: ["Sliced cooked turkey, sealed pack", "Cooked turkey slices"], category: "packaged", origin: "packaged", dietary: ["gluten_free", "lactose_free"], allergens: [], kg: [0.2, 0.4], portions: [2, 3] },
  "yoghurt.jpg": { titles: ["Natural yoghurt, 500 g", "Yoghurt, best before tomorrow"], category: "dairy", origin: "packaged", dietary: ["vegetarian", "gluten_free"], allergens: ["milk"], kg: [0.5, 1], portions: [2, 4] },
};

/** Public area labels (postcode + district) for the demo region, matched to the nearest anchor. */
const AREAS = [
  { postcode: "91054", areaName: "Altstadt", lat: 49.5985, lng: 11.0045 },
  { postcode: "91052", areaName: "Innenstadt", lat: 49.5897, lng: 11.0075 },
  { postcode: "91054", areaName: "Sieglitzhof", lat: 49.5965, lng: 11.0275 },
  { postcode: "91052", areaName: "Röthelheimpark", lat: 49.5845, lng: 11.0265 },
  { postcode: "91058", areaName: "Bruck", lat: 49.5745, lng: 11.0035 },
  { postcode: "91056", areaName: "Büchenbach", lat: 49.5875, lng: 10.9655 },
  { postcode: "91058", areaName: "Tennenlohe", lat: 49.5465, lng: 11.0365 },
  { postcode: "91088", areaName: "Bubenreuth", lat: 49.6265, lng: 11.0175 },
  { postcode: "91074", areaName: "Herzogenaurach", lat: 49.5685, lng: 10.8856 },
];
export const areaFor = (lat: number, lng: number) => {
  const a = AREAS.reduce((best, x) => (distanceM(lat, lng, x.lat, x.lng) < distanceM(lat, lng, best.lat, best.lng) ? x : best));
  return { postcode: a.postcode, areaName: a.areaName };
};

const FIRST = ["Lukas", "Emma", "Jonah", "Hannah", "Felix", "Lea", "Noah", "Marie", "Elias", "Sophie", "Paul", "Clara", "Finn", "Ida", "Leon", "Mila",
  "Aylin", "Can", "Zoe", "Nils", "Elif", "Mats", "Greta", "Yusuf", "Lina", "Theo", "Amira", "Karl", "Nora", "Jan", "Ella", "David"];
const LAST = "ABDEFGHKLMNPRSTWZ".split("");
const BIOS = [
  "Family of four, we often cook too much.",
  "Student, love baking on Sundays.",
  "Allotment gardener, too many apples every autumn.",
  "Retired, happy to share and to chat.",
  "I run a small café and hate binning pastries.",
  null, null,
];
const MESSAGES = [
  ["Hi! Could I pick it up after work, around 18:00?", "Sure, ring the bell at the side door.", "Thanks, on my way!"],
  ["Is it still available?", "Yes! Come by any time before 20:00."],
  ["Hello, I'd love this for my kids.", "Great, see you soon!", "Running 5 min late, sorry"],
  ["Can we meet at the bakery corner?", "Perfect, 17:30 works."],
];
const NOTES = ["Lovely, thank you!", "Super friendly and on time", "Exactly as described", "Very kind, would share again", "Fresh and tasty", null];

interface Ctx {
  users: Record<string, string>;
  centre: { lat: number; lng: number };
  now: Date;
  rand: () => number;
  passwordHash: string;
  photoUrl: (file: string) => Promise<string>;
  log: (m: string) => void;
}

export async function seedHistory(prisma: PrismaClient, ctx: Ctx) {
  const { rand, now } = ctx;
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (a: number, b: number) => a + rand() * (b - a);
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));
  const at = (ms: number) => new Date(now.getTime() + ms);
  const H = 3600_000;
  const D = 24 * H;
  const offset = (lat: number, lng: number, minM: number, maxM: number) => {
    const d = between(minM, maxM);
    const b = rand() * 2 * Math.PI;
    return { lat: lat + (d * Math.cos(b)) / 111320, lng: lng + (d * Math.sin(b)) / (111320 * Math.cos((lat * Math.PI) / 180)) };
  };

  // People: 24 around the centre, 8 further out (Herzogenaurach, Tennenlohe, Bubenreuth) who may post available food.
  const people: { id: string; name: string; lat: number; lng: number; outer: boolean }[] = [];
  for (let i = 0; i < FIRST.length; i++) {
    const outer = i >= 24;
    const home = outer ? offset(ctx.centre.lat, ctx.centre.lng, 2600, 9000) : offset(ctx.centre.lat, ctx.centre.lng, 200, 3500);
    const name = `${FIRST[i]} ${LAST[i % LAST.length]}.`;
    const verified = rand() < 0.6;
    const u = await prisma.user.create({
      data: {
        email: `${FIRST[i].toLowerCase()}.${LAST[i % LAST.length].toLowerCase()}@demo.freshshare.de`,
        name, passwordHash: ctx.passwordHash, homeLat: home.lat, homeLng: home.lng, bio: pick(BIOS),
        emailVerified: verified || rand() < 0.5, phoneVerified: verified, createdAt: at(-between(20, 70) * D),
        termsAcceptedAt: at(-60 * D), termsVersion: "2026-11-03",
      },
    });
    people.push({ id: u.id, name, lat: home.lat, lng: home.lng, outer });
  }
  const core = await prisma.user.findMany({ where: { id: { in: Object.values(ctx.users) } } });
  const sharers = [...people, ...core.filter((u) => u.role !== "admin").map((u) => ({ id: u.id, name: u.name, lat: u.homeLat, lng: u.homeLng, outer: false }))];
  const files = Object.keys(PHOTOS);

  async function makeListing(giver: (typeof sharers)[number], created: Date, status: "available" | "collected" | "expired" | "reserved", file = pick(files)) {
    const p = PHOTOS[file];
    const url = await ctx.photoUrl(file);
    const life = p.origin === "homemade" ? between(12, 40) * H : between(2, 10) * D;
    const pub = jitter(giver.lat, giver.lng, rand);
    return prisma.listing.create({
      data: {
        giverId: giver.id, title: pick(p.titles), category: p.category, origin: p.origin, allergens: p.allergens, dietaryTags: p.dietary,
        weightKg: Math.round(between(p.kg[0], p.kg[1]) * 10) / 10, portions: int(p.portions[0], p.portions[1]),
        bestBefore: new Date(created.getTime() + life), photoUrl: url, photos: [url], lat: giver.lat, lng: giver.lng,
        publicLat: pub.lat, publicLng: pub.lng, ...areaFor(giver.lat, giver.lng), handoverSpot: rand() < 0.2 ? "Bakery at the corner" : null,
        pickupFrom: created, pickupUntil: new Date(created.getTime() + between(3, 10) * H), status, createdAt: created,
      },
    });
  }

  async function completeClaim(listingId: string, giverId: string, receiverId: string, created: Date, extra: { organizationId?: string; bulkClaimId?: string } = {}) {
    const claim = await prisma.claim.create({
      data: { listingId, receiverId, status: "collected", holdUntil: new Date(created.getTime() + 30 * 60_000), createdAt: created, ...extra },
    });
    const convo = pick(MESSAGES);
    for (let i = 0; i < convo.length; i++) {
      await prisma.message.create({ data: { claimId: claim.id, senderId: i % 2 === 0 ? receiverId : giverId, body: convo[i], createdAt: new Date(created.getTime() + (i + 1) * 9 * 60_000) } });
    }
    if (rand() < 0.85) await prisma.rating.create({ data: { claimId: claim.id, fromUserId: receiverId, toUserId: giverId, stars: rand() < 0.8 ? 5 : 4, note: pick(NOTES), createdAt: new Date(created.getTime() + 4 * H) } });
    if (rand() < 0.65) await prisma.rating.create({ data: { claimId: claim.id, fromUserId: giverId, toUserId: receiverId, stars: rand() < 0.85 ? 5 : 4, note: pick(NOTES), createdAt: new Date(created.getTime() + 5 * H) } });
    return claim;
  }

  // ~105 past listings over 8 weeks: most collected, some expired unclaimed.
  let collected = 0;
  let expired = 0;
  for (let i = 0; i < 105; i++) {
    const giver = pick(sharers);
    const created = at(-between(1.2, 56) * D);
    const done = rand() < 0.78;
    const l = await makeListing(giver, created, done ? "collected" : "expired");
    if (done) {
      let receiver = pick(sharers);
      while (receiver.id === giver.id) receiver = pick(sharers);
      await completeClaim(l.id, giver.id, receiver.id, new Date(created.getTime() + between(0.3, 3) * H));
      collected++;
    } else expired++;
  }

  // A dozen available listings further out (2.6-9 km), visible when the map radius is 5 or 10 km.
  const outer = people.filter((p) => p.outer && distanceM(p.lat, p.lng, ctx.centre.lat, ctx.centre.lng) > 2200);
  for (let i = 0; i < 12; i++) await makeListing(outer[i % outer.length], at(-between(0.2, 6) * H), "available");
  ctx.log(`history: ${people.length} more users, ${collected} collected + ${expired} expired listings, 12 available further out`);

  // Recompute ratings for the generated people (the hand-written pitch users keep their file values).
  for (const p of people) {
    const agg = await prisma.rating.aggregate({ where: { toUserId: p.id }, _avg: { stars: true }, _count: true });
    await prisma.user.update({ where: { id: p.id }, data: { ratingAvg: agg._avg.stars ?? 0, ratingCount: agg._count } });
  }

  // Six more approved fridges (8 in total) with two weeks of check-ins.
  const FRIDGES: { name: string; kind: FridgeKind; hours: string; access?: string }[] = [
    { name: "Demo Fridge: Market Square", kind: "fridge", hours: "Daily 07:00-22:00" },
    { name: "Demo Pantry: Library Steps", kind: "pantry", hours: "Mon-Sat 09:00-19:00", access: "Shelf left of the entrance" },
    { name: "Demo Fridge: Youth Centre", kind: "fridge", hours: "Mon-Fri 12:00-20:00" },
    { name: "Demo Drop-off: Bike Café", kind: "dropoff", hours: "Tue-Sun 10:00-18:00", access: "Hand it to the staff" },
    { name: "Demo Fridge: Herzogenaurach Station", kind: "fridge", hours: "Daily 06:00-23:00" },
    { name: "Demo Pantry: Tennenlohe Church", kind: "pantry", hours: "Daily 08:00-20:00" },
  ];
  const CONTENTS = ["Bread and rolls", "Yoghurt and cheese", "Apples, carrots", "Mostly empty, some tea", "Pasta, tins, rice", "Salad and tomatoes", null];
  for (const [i, f] of FRIDGES.entries()) {
    const spot = i >= 4 ? offset(ctx.centre.lat, ctx.centre.lng, 4000, 9000) : offset(ctx.centre.lat, ctx.centre.lng, 400, 2500);
    const row = await prisma.fridge.create({
      data: {
        name: f.name, kind: f.kind, address: `Placeholder address, ${areaFor(spot.lat, spot.lng).areaName}`, lat: spot.lat, lng: spot.lng,
        openingHours: f.hours, accessNotes: f.access ?? null, description: "Fictional demo location.", status: "active", createdAt: at(-60 * D),
      },
    });
    for (let k = 0; k < int(3, 6); k++) {
      const fill = pick<FillLevel>(["empty", "low", "half", "full", "half"]);
      await prisma.fridgeCheckIn.create({
        data: { fridgeId: row.id, userId: pick(people).id, fillLevel: fill, state: fill === "empty" ? "empty" : "stocked", contents: pick(CONTENTS), createdAt: at(-between(0.1, 14) * D) },
      });
    }
  }

  // Three more approved organizations; every organization gets past pickup runs with collected items.
  const ORGS: { name: string; type: OrgType; mission: string }[] = [
    { name: "Demo NGO: Food Rescue Erlangen", type: "ngo", mission: "Rescue surplus from shops and share it the same day." },
    { name: "Demo Charity: Warm Meals", type: "charity", mission: "A warm lunch for everyone who needs one, five days a week." },
    { name: "Demo Community Center Bruck", type: "community_center", mission: "A neighbourhood living room with a shared pantry." },
  ];
  const freePeople = [...people.filter((p) => !p.outer)];
  for (const o of ORGS) {
    const spot = offset(ctx.centre.lat, ctx.centre.lng, 500, 3000);
    const crew = [freePeople.shift()!, freePeople.shift()!, freePeople.shift()!];
    await prisma.organization.create({
      data: {
        name: o.name, type: o.type, email: `${o.type.replace("_", "")}@demo.freshshare.de`, address: "Placeholder address", city: "Erlangen",
        lat: spot.lat, lng: spot.lng, description: `Fictional demo organization. ${o.mission}`, mission: o.mission, serviceArea: "Erlangen",
        contactName: crew[0].name, status: "approved", createdById: crew[0].id, verifiedAt: at(-40 * D), verifiedById: ctx.users.admin ?? null, createdAt: at(-45 * D),
        members: { create: crew.map((c, i) => ({ userId: c.id, role: (["admin", "manager", "volunteer"] as OrgRole[])[i] })) },
      },
    });
  }
  const orgs = await prisma.organization.findMany({ where: { status: "approved" }, include: { members: true } });
  let runs = 0;
  for (const org of orgs) {
    const manager = org.members.find((m) => m.role === "manager") ?? org.members[0];
    const memberIds = new Set(org.members.map((m) => m.userId));
    for (let r = 0; r < int(2, 3); r++) {
      const day = at(-between(2, 50) * D);
      const bulk = await prisma.bulkClaim.create({
        data: { organizationId: org.id, createdById: manager.userId, name: pick(["Saturday run", "Weekday pickup", "Bakery round", "Market run"]),
          scheduledPickupDate: day, status: "completed", completedAt: day, createdAt: new Date(day.getTime() - D) },
      });
      for (let k = 0; k < int(2, 4); k++) {
        let giver = pick(sharers);
        while (memberIds.has(giver.id)) giver = pick(sharers);
        const l = await makeListing(giver, new Date(day.getTime() - 20 * H), "collected");
        const claim = await completeClaim(l.id, giver.id, manager.userId, new Date(day.getTime() - 19 * H), { organizationId: org.id, bulkClaimId: bulk.id });
        await prisma.bulkClaimItem.create({ data: { bulkClaimId: bulk.id, listingId: l.id, claimId: claim.id, isCollected: true, collectedAt: day } });
      }
      runs++;
    }
  }
  ctx.log(`history: ${FRIDGES.length} more fridges, ${ORGS.length} more organizations, ${runs} past pickup runs`);

  // Early-access sign-ups by role and source.
  const ROLES: EarlyAccessRole[] = ["giver", "giver", "receiver", "receiver", "receiver", "business", "fridge_host", "organization"];
  const SOURCES = ["instagram", "flyer", "whatsapp", "survey", "nebenan", null];
  const POSTCODES = ["91052", "91054", "91056", "91058", "91074", "91088", null];
  for (let i = 1; i <= 64; i++) {
    await prisma.earlyAccessSignup.create({
      data: { email: `early${i}@demo.freshshare.de`, role: pick(ROLES), source: pick(SOURCES), postcode: pick(POSTCODES), language: pick(["de", "de", "en"]),
        consentAt: at(-between(0.5, 30) * D), createdAt: at(-between(0.5, 30) * D) },
    });
  }

  // A few open reports for the admin queue.
  // One about food that is still on the map (so the demo can show "Remove listing"), two about past pickups.
  const generatedIds = people.map((p) => p.id);
  const someListings = [
    ...(await prisma.listing.findMany({ where: { status: "available", giverId: { in: generatedIds } }, take: 1, orderBy: { createdAt: "desc" } })),
    ...(await prisma.listing.findMany({ where: { status: { in: ["collected", "expired"] }, giverId: { in: generatedIds } }, take: 2, orderBy: { createdAt: "desc" } })),
  ];
  const reasons: ReportReason[] = ["unsafe_food", "no_show", "spam"];
  for (const [i, l] of someListings.entries()) {
    await prisma.report.create({ data: { listingId: l.id, userId: pick(people).id, reason: reasons[i], note: i === 0 ? "The photo looks past its best" : null, createdAt: at(-between(1, 48) * H) } });
  }
  await prisma.report.create({ data: { reportedUserId: people[3].id, userId: people[7].id, reason: "no_show", note: "Didn't turn up twice", createdAt: at(-20 * H) } });
  ctx.log("history: 64 early-access sign-ups, 4 open reports");
}
