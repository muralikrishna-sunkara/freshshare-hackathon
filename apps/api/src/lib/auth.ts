import type { CookieOptions, Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";
import { HttpError } from "./errors.js";
import { prisma } from "./prisma.js";

export const COOKIE = "fs_token";
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export interface AuthUser {
  id: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export const signToken = (userId: string) => jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });

/** `secure` follows the request scheme (ALB sets X-Forwarded-Proto), so the cookie also works on the plain-HTTP ALB URL. */
export const cookieOptions = (req: Request): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: req.secure,
  path: "/",
  maxAge: MAX_AGE_MS,
});

/** Reads the JWT cookie if present; never rejects. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (typeof token === "string") {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (typeof payload === "object" && typeof payload.sub === "string") req.user = { id: payload.sub };
    } catch {
      /* invalid or expired: treat as anonymous */
    }
  }
  next();
};

export const suspendedError = (reason: string | null) =>
  new HttpError(403, "suspended", `Your account is suspended${reason ? `: ${reason}` : ""}. Contact us via the contact page if you think this is a mistake.`);

/** Signed-in users only. Suspended accounts (T2.5) are refused on every request, not only at login. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, "unauthenticated", "Please sign in first"));
  prisma.user
    .findUnique({ where: { id: req.user.id }, select: { suspendedAt: true, suspendedReason: true } })
    .then((u) => {
      if (!u) return next(new HttpError(401, "unauthenticated", "Please sign in first"));
      if (u.suspendedAt) return next(suspendedError(u.suspendedReason));
      next();
    })
    .catch(next);
};

export function userId(req: Request): string {
  if (!req.user) throw new HttpError(401, "unauthenticated", "Please sign in first");
  return req.user.id;
}

/** Site admins only. Non-admins get 403 (signed-out users 401). Role is read from the database on every call. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, "unauthenticated", "Please sign in first"));
  prisma.user
    .findUnique({ where: { id: req.user.id }, select: { role: true } })
    .then((u) => (u?.role === "admin" ? next() : next(new HttpError(403, "forbidden", "Admins only"))))
    .catch(next);
};

export async function isAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  return (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role === "admin";
}
