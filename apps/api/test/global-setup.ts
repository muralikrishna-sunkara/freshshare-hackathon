import { execSync } from "node:child_process";

export default function setup() {
  process.env.DATABASE_URL ??= "postgresql://freshshare:freshshare@localhost:5432/freshshare_test";
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
