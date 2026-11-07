import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../lib/auth.js";
import { ah } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { pushEnabled, pushKeys, sendPush } from "../lib/push.js";

const CATEGORIES = ["leftovers", "fruit_veg", "bread", "packaged", "dairy", "other"] as const;

/** T2.2 nearby alerts: one alert area per person (centre defaults to their home), radius and categories. */
export const alerts = Router();
alerts.use(requireAuth);

const view = (a: { lat: number; lng: number; radiusM: number; categories: string[] } | null) =>
  a ? { enabled: true, lat: a.lat, lng: a.lng, radiusM: a.radiusM, categories: a.categories } : { enabled: false, lat: null, lng: null, radiusM: 2000, categories: [] };

alerts.get(
  "/",
  ah(async (req, res) => {
    const a = await prisma.alertSubscription.findFirst({ where: { userId: userId(req) } });
    res.json({ alert: view(a), maxPerWindowMinutes: 20 });
  }),
);

const alertBody = z.object({
  enabled: z.boolean(),
  radiusM: z.number().int().min(250).max(10000).default(2000),
  categories: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length).default([]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

alerts.put(
  "/",
  ah(async (req, res) => {
    const me = userId(req);
    const b = alertBody.parse(req.body);
    await prisma.alertSubscription.deleteMany({ where: { userId: me } });
    if (!b.enabled) return res.json({ alert: view(null) });
    const home = await prisma.user.findUniqueOrThrow({ where: { id: me }, select: { homeLat: true, homeLng: true } });
    const a = await prisma.alertSubscription.create({
      data: { userId: me, lat: b.lat ?? home.homeLat, lng: b.lng ?? home.homeLng, radiusM: b.radiusM, categories: [...new Set(b.categories)] },
    });
    res.json({ alert: view(a) });
  }),
);

/** Web push subscriptions for this device (T2.2). */
export const push = Router();

push.get("/key", (_req, res) => {
  res.json({ enabled: pushEnabled(), publicKey: pushKeys()?.publicKey ?? null });
});

const subBody = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "Push endpoint must be https"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

push.post(
  "/subscriptions",
  requireAuth,
  ah(async (req, res) => {
    const b = subBody.parse(req.body);
    const me = userId(req);
    // An endpoint belongs to one browser profile: re-subscribing moves it to whoever is signed in now.
    await prisma.pushSubscription.upsert({
      where: { endpoint: b.endpoint },
      create: { userId: me, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth },
      update: { userId: me, p256dh: b.keys.p256dh, auth: b.keys.auth },
    });
    res.status(201).json({ ok: true, devices: await prisma.pushSubscription.count({ where: { userId: me } }) });
  }),
);

push.delete(
  "/subscriptions",
  requireAuth,
  ah(async (req, res) => {
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body ?? {});
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: userId(req) } });
    res.json({ ok: true });
  }),
);

push.post(
  "/test",
  requireAuth,
  ah(async (req, res) => {
    const sent = await sendPush(userId(req), { title: "FreshShare alerts are on", body: "You'll get a notification like this when food is posted near you.", link: "/map", tag: "test" });
    res.json({ sent });
  }),
);
