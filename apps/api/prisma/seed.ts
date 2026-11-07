import { PrismaClient } from "@prisma/client";
import { storage } from "../src/lib/storage.js";
import { runSeed } from "../src/services/seed.js";

const prisma = new PrismaClient();

runSeed(prisma, storage(), { log: (m) => console.log(`[seed] ${m}`) })
  .then((r) => {
    console.log(`[seed] done from ${r.dir}`);
    // Demo logins for the pitch (all fictional, all use the demo password from data/seed.json).
    console.table([
      { role: "Site admin (/admin)", email: "admin@demo.freshshare.de" },
      { role: "Verified giver", email: "anna@demo.freshshare.de" },
      { role: "Receiver", email: "sara@demo.freshshare.de" },
      { role: "New, unverified user", email: "ben@demo.freshshare.de" },
      { role: "Food bank admin", email: "rosa@demo.freshshare.de" },
    ]);
  })
  .catch((e) => {
    console.error("[seed] failed", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
