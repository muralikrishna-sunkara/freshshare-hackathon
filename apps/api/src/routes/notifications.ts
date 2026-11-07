import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export const notifications = Router();
notifications.use(requireAuth);

const view = (n: { id: string; type: string; title: string; body: string; link: string | null; readAt: Date | null; createdAt: Date }) => ({
  id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.readAt, createdAt: n.createdAt,
});
const unreadCount = (uid: string) => prisma.notification.count({ where: { userId: uid, readAt: null } });

/** My latest notifications (newest first) and how many are unread. `?unread=1` shows only unread ones. */
notifications.get(
  "/",
  ah(async (req, res) => {
    const { unread } = z.object({ unread: z.enum(["0", "1"]).optional() }).parse(req.query);
    const uid = userId(req);
    const [rows, count] = await Promise.all([
      prisma.notification.findMany({ where: { userId: uid, ...(unread === "1" ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: 50 }),
      unreadCount(uid),
    ]);
    res.json({ notifications: rows.map(view), unreadCount: count });
  }),
);

notifications.post(
  "/read-all",
  ah(async (req, res) => {
    const uid = userId(req);
    const r = await prisma.notification.updateMany({ where: { userId: uid, readAt: null }, data: { readAt: new Date() } });
    res.json({ ok: true, marked: r.count, unreadCount: 0 });
  }),
);

notifications.post(
  "/:id/read",
  ah(async (req, res) => {
    const id = z.string().min(1).max(40).parse(req.params.id);
    const uid = userId(req);
    const r = await prisma.notification.updateMany({ where: { id, userId: uid }, data: { readAt: new Date() } });
    if (r.count === 0) throw new HttpError(404, "not_found", "Notification not found");
    res.json({ ok: true, unreadCount: await unreadCount(uid) });
  }),
);

/**
 * Live unread count over Server-Sent Events. Each stream checks Postgres every 3 s and sends `unread` when the
 * count or the newest notification changes, so it works with several api tasks behind the ALB.
 */
notifications.get(
  "/stream",
  ah(async (req, res) => {
    const uid = userId(req);
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    let last = "";
    let closed = false;
    const tick = async () => {
      if (closed) return;
      try {
        const [count, newest] = await Promise.all([
          unreadCount(uid),
          prisma.notification.findFirst({ where: { userId: uid }, orderBy: { createdAt: "desc" } }),
        ]);
        const key = `${count}:${newest?.id ?? ""}`;
        if (key !== last) {
          last = key;
          res.write(`event: unread\ndata: ${JSON.stringify({ unreadCount: count, latest: newest ? view(newest) : null })}\n\n`);
        }
      } catch {
        /* try again next tick */
      }
    };
    await tick();
    const poll = setInterval(tick, 3000);
    const beat = setInterval(() => res.write(": ping\n\n"), 15000);
    req.on("close", () => {
      closed = true;
      clearInterval(poll);
      clearInterval(beat);
    });
  }),
);
