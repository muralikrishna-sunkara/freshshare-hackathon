import path from "node:path";
import { fileURLToPath } from "node:url";

// Recording target. The video records the real app: real clicks, real database writes.
// Default is the live AWS deployment; set APP_URL=http://localhost:5173 to record a local `npm run dev`.
export const APP_URL = (process.env.APP_URL ?? "https://freshshare.de").replace(/\/$/, "");
export const IS_LOCAL = /localhost|127\.0\.0\.1/.test(APP_URL);

export const DEMO_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(DEMO_DIR, "..");
export const OUT = path.join(DEMO_DIR, "out");
export const WORK = path.join(OUT, "work");
export const AUTH_DIR = path.join(OUT, ".auth");

// DEMO: the seeded demo accounts (data/seed.json). Only @demo.freshshare.de accounts are ever used.
// Override from .env with DEMO_GIVER_EMAIL / DEMO_RECEIVER_EMAIL / DEMO_ADMIN_EMAIL and DEMO_PASSWORD.
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "freshshare-demo"; // DEMO seed password
export const ACCOUNTS = {
  anna: process.env.DEMO_GIVER_EMAIL ?? "anna@demo.freshshare.de", // giver
  sara: process.env.DEMO_RECEIVER_EMAIL ?? "sara@demo.freshshare.de", // receiver
  admin: process.env.DEMO_ADMIN_EMAIL ?? "admin@demo.freshshare.de",
  mehmet: "mehmet@demo.freshshare.de",
  lena: "lena@demo.freshshare.de",
  priya: "priya@demo.freshshare.de",
  tom: "tom@demo.freshshare.de",
  jonas: "jonas@demo.freshshare.de",
  ben: "ben@demo.freshshare.de",
  rosa: "rosa@demo.freshshare.de", // org admin
  bent: "bent@demo.freshshare.de", // org manager
  mia: "mia@demo.freshshare.de", // org volunteer
  omar: "omar@demo.freshshare.de", // org viewer
} as const;
export type DemoRole = keyof typeof ACCOUNTS;
/** "tester": a separate fresh test account for the new-user chapter (verification, alerts).
 *  Credentials only from the environment (DEMO_TEST_EMAIL / DEMO_TEST_PASSWORD), never committed. */
export type Role = DemoRole | "tester";
export const TEST_ACCOUNT = process.env.DEMO_TEST_EMAIL && process.env.DEMO_TEST_PASSWORD ? { email: process.env.DEMO_TEST_EMAIL, password: process.env.DEMO_TEST_PASSWORD } : null;

export function credentials(role: Role): { email: string; password: string } {
  if (role === "tester") {
    if (!TEST_ACCOUNT) throw new Error("no test account: set DEMO_TEST_EMAIL and DEMO_TEST_PASSWORD");
    return TEST_ACCOUNT;
  }
  return { email: ACCOUNTS[role], password: DEMO_PASSWORD };
}

for (const e of Object.values(ACCOUNTS)) {
  if (!e.endsWith("@demo.freshshare.de")) throw new Error(`Demo accounts must be @demo.freshshare.de, got ${e}`);
}

/** Seeded givers, keyed by the display name the API returns. */
export const GIVER_BY_NAME: Record<string, DemoRole> = {
  "Anna K.": "anna",
  "Mehmet Y.": "mehmet",
  "Lena S.": "lena",
  "Priya R.": "priya",
  "Tom B.": "tom",
  "Jonas W.": "jonas",
};

// Look: the app's brand greens (CLAUDE.md), white text.
export const GREEN = "#6b9f5e";
export const GREEN_DARK = "#3f6b35";
export const ORANGE = "#e89344";

export const VOICE = process.env.DEMO_VOICE ?? "en-US-AriaNeural";
export const MAX_TOTAL_SECONDS = 240;
