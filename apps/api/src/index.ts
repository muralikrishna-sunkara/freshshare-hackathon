import { createApp } from "./app.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { housekeeping } from "./services/claims.js";

const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, "api listening"));

// Background job (fine for the demo): lapse holds, expire old listings.
const job = setInterval(() => {
  housekeeping().catch((err) => logger.error({ err }, "housekeeping failed"));
}, 60_000);

const shutdown = () => {
  clearInterval(job);
  server.close(() => void prisma.$disconnect().finally(() => process.exit(0)));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
