import { Router } from "express";
import { z } from "zod";
import { ah } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { authLimiter } from "../lib/rateLimit.js";

export const earlyAccess = Router();

const body = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(200),
  role: z.enum(["giver", "receiver", "business", "fridge_host", "organization"], {
    errorMap: () => ({ message: "Please pick how you'd use FreshShare" }),
  }),
  postcode: z
    .string()
    .trim()
    .max(10)
    .regex(/^[0-9A-Za-z -]*$/, "Please enter a valid postcode")
    .optional()
    .transform((v) => (v ? v : null)),
  source: z
    .string()
    .trim()
    .max(40)
    .regex(/^[\w.-]*$/)
    .optional()
    .catch(undefined)
    .transform((v) => (v ? v.toLowerCase() : null)),
  language: z.string().trim().max(10).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree that we may email you about the launch" }) }),
});

/** Early-access sign-up from the landing page. Upserts on email so a second sign-up updates the role. */
earlyAccess.post(
  "/",
  authLimiter,
  ah(async (req, res) => {
    const b = body.parse(req.body);
    const data = { role: b.role, postcode: b.postcode, language: b.language ?? null, consentAt: new Date() };
    await prisma.earlyAccessSignup.upsert({
      where: { email: b.email },
      create: { email: b.email, source: b.source, ...data },
      update: data, // keep the first source we saw
    });
    res.status(201).json({ ok: true });
  }),
);
