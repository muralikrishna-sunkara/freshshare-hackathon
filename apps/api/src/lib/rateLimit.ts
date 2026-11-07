import { rateLimit } from "express-rate-limit";
import { env } from "./env.js";

const skip = () => env.NODE_ENV === "test";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: { code: "rate_limited", message: "Too many attempts, please wait a few minutes" } },
});

export const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: { code: "rate_limited", message: "You've shared a lot this hour, please try again later" } },
});

/** K1 photo autofill: each call costs money, so 30 photos an hour per user. */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  keyGenerator: (req) => req.user?.id ?? "anon", // runs after requireAuth
  message: { error: { code: "rate_limited", message: "That's a lot of photos this hour. Please fill in the details yourself for now." } },
});
