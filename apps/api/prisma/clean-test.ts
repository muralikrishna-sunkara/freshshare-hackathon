import { PrismaClient } from "@prisma/client";
import { cleanTestUsers } from "../src/services/cleanTest.js";

const prisma = new PrismaClient();
cleanTestUsers(prisma)
  .then((r) => console.log(`Removed ${r.users} test users, ${r.listings} of their listings, ${r.earlyAccess} test sign-ups.`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
