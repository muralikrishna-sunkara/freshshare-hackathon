import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { claimView, loadClaim, myClaims, transition } from "../services/claims.js";
import { rateClaim } from "../services/ratings.js";

export const claims = Router();
claims.use(requireAuth);

const idParam = z.object({ id: z.string().min(1) });

claims.get(
  "/",
  ah(async (req, res) => {
    res.json(await myClaims(userId(req)));
  }),
);

claims.get(
  "/:id",
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const c = await loadClaim(id, userId(req));
    res.json({ claim: claimView(c, c.role) });
  }),
);

for (const action of ["confirm", "collected", "cancel", "decline"] as const) {
  claims.post(
    `/:id/${action}`,
    ah(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const c = await transition(id, userId(req), action);
      res.json({ claim: claimView(c, c.role) });
    }),
  );
}

const ratingBody = z.object({
  stars: z.number().int().min(1, "Pick 1 to 5 stars").max(5, "Pick 1 to 5 stars"),
  note: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
});

claims.post(
  "/:id/ratings",
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const b = ratingBody.parse(req.body);
    const c = await rateClaim(id, userId(req), b.stars, b.note);
    res.status(201).json({ claim: claimView(c, c.role) });
  }),
);

const messagesQuery = z.object({ after: z.coerce.date().optional() });
const messageBody = z.object({ body: z.string().trim().min(1, "Write a message").max(500) });

claims.get(
  "/:id/messages",
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { after } = messagesQuery.parse(req.query);
    await loadClaim(id, userId(req)); // 403 for anyone but the two parties
    const messages = await prisma.message.findMany({
      where: { claimId: id, ...(after ? { createdAt: { gt: after } } : {}) },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({ messages });
  }),
);

claims.post(
  "/:id/messages",
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { body } = messageBody.parse(req.body);
    const me = userId(req);
    const c = await loadClaim(id, me);
    if (c.status === "cancelled" || c.status === "lapsed" || c.status === "declined") throw new HttpError(409, "closed", "This pickup is closed");
    const message = await prisma.message.create({ data: { claimId: id, senderId: me, body } });
    res.status(201).json({ message });
  }),
);

/**
 * Live chat over Server-Sent Events. Each open stream checks the database for new messages every
 * 1.5 s, so it works across several api tasks without a shared broker. Heartbeats keep the ALB connection open.
 */
claims.get(
  "/:id/stream",
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await loadClaim(id, userId(req)); // only the two parties
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    let since = messagesQuery.parse(req.query).after ?? new Date();
    let closed = false;
    const tick = async () => {
      if (closed) return;
      try {
        const fresh = await prisma.message.findMany({ where: { claimId: id, createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, take: 50 });
        for (const m of fresh) res.write(`event: message\ndata: ${JSON.stringify(m)}\n\n`);
        if (fresh.length) since = fresh[fresh.length - 1].createdAt;
      } catch {
        /* try again next tick */
      }
    };
    const poll = setInterval(tick, 1500);
    const beat = setInterval(() => res.write(": ping\n\n"), 15000);
    res.write("event: ready\ndata: {}\n\n");
    req.on("close", () => {
      closed = true;
      clearInterval(poll);
      clearInterval(beat);
    });
  }),
);
