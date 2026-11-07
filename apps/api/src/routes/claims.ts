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

for (const action of ["confirm", "collected", "cancel"] as const) {
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
    if (c.status === "cancelled" || c.status === "lapsed") throw new HttpError(409, "closed", "This pickup is closed");
    const message = await prisma.message.create({ data: { claimId: id, senderId: me, body } });
    res.status(201).json({ message });
  }),
);
