import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const health = Router();

health.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", service: "api", db: "ok" });
  } catch {
    res.status(503).json({ status: "error", service: "api", db: "unreachable" });
  }
});
