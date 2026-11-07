import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

export const COOKIE = "fs_token";

export interface AuthUser {
  id: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export const signToken = (userId: string) => jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });

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
