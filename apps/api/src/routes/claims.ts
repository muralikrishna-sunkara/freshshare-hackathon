import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../lib/auth.js";
import { ah } from "../lib/errors.js";
import { claimView, loadClaim, myClaims, transition } from "../services/claims.js";

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
