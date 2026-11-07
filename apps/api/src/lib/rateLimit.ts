import { rateLimit } from "express-rate-limit";
import { env } from "./env.js";

const skip = () => env.NODE_ENV === "test";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
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
