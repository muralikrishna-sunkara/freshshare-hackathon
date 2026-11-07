import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { optionalAuth } from "./lib/auth.js";
import { env } from "./lib/env.js";
import { errorHandler, notFound } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { auth, me } from "./routes/auth.js";
import { claims } from "./routes/claims.js";
import { earlyAccess } from "./routes/earlyAccess.js";
import { notifications } from "./routes/notifications.js";
import { fridges } from "./routes/fridges.js";
import { health } from "./routes/health.js";
import { impact } from "./routes/impact.js";
import { listings } from "./routes/listings.js";
import { reports } from "./routes/reports.js";
import { admin } from "./routes/admin.js";
import { bulkClaims, organizations } from "./routes/organizations.js";
import { users } from "./routes/users.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(optionalAuth);

  if (env.STORAGE_DRIVER === "local") {
    app.use("/uploads", express.static(path.resolve(env.UPLOADS_DIR), { maxAge: "1d" }));
  }

  const api = express.Router();
  api.use("/health", health);
  api.use("/auth", auth);
  api.use("/me", me);
  api.use("/listings", listings);
  api.use("/fridges", fridges);
  api.use("/claims", claims);
  api.use("/impact", impact);
  api.use("/users", users);
  api.use("/reports", reports);
  api.use("/organizations", organizations);
  api.use("/bulk-claims", bulkClaims);
  api.use("/admin", admin);
  api.use("/notifications", notifications);
  api.use("/early-access", earlyAccess);
  api.use(notFound);
  app.use("/api", api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
