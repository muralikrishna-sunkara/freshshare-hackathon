import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { COOKIE, cookieOptions, requireAuth, signToken, suspendedError, userId } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { authLimiter } from "../lib/rateLimit.js";
import { TERMS_VERSION } from "../services/rules.js";
import { meView } from "../services/users.js";
import { renderEmail, sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

export const auth = Router();
export const me = Router();

const BCRYPT_COST = process.env.NODE_ENV === "test" ? 4 : 12;

const registerBody = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(60),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  homeLat: z.number().min(-90).max(90),
  homeLng: z.number().min(-180).max(180),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: "You must be 16 or older to use FreshShare" }) }),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "Please read and accept the Terms & Conditions" }) }),
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
        data: {
          name: b.name,
          email: b.email,
          passwordHash: await bcrypt.hash(b.password, BCRYPT_COST),
          homeLat: b.homeLat,
          homeLng: b.homeLng,
          termsAcceptedAt: new Date(),
          termsVersion: TERMS_VERSION,
        },
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
    if (user.suspendedAt) throw suspendedError(user.suspendedReason);
    res.cookie(COOKIE, signToken(user.id), cookieOptions(req));
    res.json({ user: await meView(user) });
  }),
);

export const RESET_TTL_MS = 60 * 60_000;
const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Forgot password: emails a one-hour, single-use link. Always answers the same way, so it can't be used
 * to find out who has an account.
 */
auth.post(
  "/forgot",
  authLimiter,
  ah(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email("Please enter a valid email") }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.suspendedAt) {
      const token = randomBytes(32).toString("base64url");
      await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
      const link = `/reset-password?token=${token}`;
      const { text, html } = renderEmail({
        title: "Reset your FreshShare password",
        body: `Hi ${user.name.split(" ")[0]}, someone (hopefully you) asked to reset your password. The link works once, for one hour. If it wasn't you, ignore this email: your password stays the same.`,
        link,
        cta: "Choose a new password",
        transactional: "You get this because a password reset was requested for your FreshShare account.",
      });
      const sent = await sendEmail({ to: user.email, subject: "Reset your FreshShare password", text, html });
      if (!sent) logger.warn({ userId: user.id }, "password reset email not sent");
    }
    res.json({ ok: true, message: "If an account exists for that email, we've sent a link to reset the password." });
  }),
);

const resetBody = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

/** Sets the new password from a reset link and signs the person in. */
auth.post(
  "/reset",
  authLimiter,
  ah(async (req, res) => {
    const b = resetBody.parse(req.body);
    const r = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(b.token) } });
    if (!r || r.usedAt || r.expiresAt < new Date()) throw new HttpError(400, "invalid_token", "This reset link has expired or was already used. Ask for a new one.");
    const user = await prisma.user.findUnique({ where: { id: r.userId } });
    if (!user) throw new HttpError(400, "invalid_token", "This reset link has expired or was already used. Ask for a new one.");
    if (user.suspendedAt) throw suspendedError(user.suspendedReason);
    const used = await prisma.passwordReset.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count === 0) throw new HttpError(400, "invalid_token", "This reset link has expired or was already used. Ask for a new one.");
    const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(b.password, BCRYPT_COST) } });
    await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });
    res.cookie(COOKIE, signToken(user.id), cookieOptions(req));
    res.json({ user: await meView(updated) });
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

// DEMO: no SMS or email provider on hackathon day. Code 123456 verifies the phone,
// and the email step is a one-tap confirmation. Both are labelled DEMO in the UI.
const DEMO_PHONE_CODE = "123456"; // DEMO
const phoneBody = z.object({
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, "Please enter a phone number"),
  code: z.string().trim(),
});

me.post(
  "/verify-phone",
  requireAuth,
  ah(async (req, res) => {
    const b = phoneBody.parse(req.body);
    if (b.code !== DEMO_PHONE_CODE) throw new HttpError(400, "wrong_code", "That code isn't right (DEMO code: 123456)"); // DEMO
    const user = await prisma.user.update({ where: { id: userId(req) }, data: { phoneVerified: true } });
    res.json({ user: await meView(user) });
  }),
);

me.post(
  "/verify-email",
  requireAuth,
  ah(async (req, res) => {
    // DEMO: real email confirmation would send a link; here one tap marks it confirmed.
    const user = await prisma.user.update({ where: { id: userId(req) }, data: { emailVerified: true } });
    res.json({ user: await meView(user) });
  }),
);

const profileBody = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(60).optional(),
  bio: z.string().trim().max(300, "Keep your bio under 300 characters").nullable().optional(),
  homeLat: z.number().min(-90).max(90).optional(),
  homeLng: z.number().min(-180).max(180).optional(),
  emailNotifications: z.boolean().optional(),
});

me.patch(
  "/",
  requireAuth,
  ah(async (req, res) => {
    const b = profileBody.parse(req.body);
    if ((b.homeLat === undefined) !== (b.homeLng === undefined)) throw new HttpError(400, "validation_error", "Send both homeLat and homeLng");
    const user = await prisma.user.update({
      where: { id: userId(req) },
      data: { name: b.name, bio: b.bio === "" ? null : b.bio, homeLat: b.homeLat, homeLng: b.homeLng, emailNotifications: b.emailNotifications },
    });
    res.json({ user: await meView(user) });
  }),
);
