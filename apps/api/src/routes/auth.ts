import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { COOKIE, cookieOptions, requireAuth, signToken, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { authLimiter } from "../lib/rateLimit.js";
import { meView } from "../services/users.js";

export const auth = Router();
export const me = Router();

const BCRYPT_COST = process.env.NODE_ENV === "test" ? 4 : 12;

const registerBody = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(60),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  homeLat: z.number().min(-90).max(90),
  homeLng: z.number().min(-180).max(180),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

auth.post(
  "/register",
  authLimiter,
  ah(async (req, res) => {
    const b = registerBody.parse(req.body);
    try {
      const user = await prisma.user.create({
        data: { name: b.name, email: b.email, passwordHash: await bcrypt.hash(b.password, BCRYPT_COST), homeLat: b.homeLat, homeLng: b.homeLng },
      });
      res.cookie(COOKIE, signToken(user.id), cookieOptions(req));
      res.status(201).json({ user: await meView(user) });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "email_taken", "An account with this email already exists");
      }
      throw e;
    }
  }),
);

auth.post(
  "/login",
  authLimiter,
  ah(async (req, res) => {
    const b = loginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: b.email } });
    if (!user || !(await bcrypt.compare(b.password, user.passwordHash))) {
      throw new HttpError(401, "invalid_credentials", "Email or password is wrong");
    }
    res.cookie(COOKIE, signToken(user.id), cookieOptions(req));
    res.json({ user: await meView(user) });
  }),
);

auth.post("/logout", (req, res) => {
  const { maxAge: _maxAge, ...opts } = cookieOptions(req);
  res.clearCookie(COOKIE, opts);
  res.status(204).end();
});

me.get(
  "/",
  requireAuth,
  ah(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: userId(req) } });
    if (!user) throw new HttpError(401, "unauthenticated", "Please sign in first");
    res.json({ user: await meView(user) });
  }),
);
