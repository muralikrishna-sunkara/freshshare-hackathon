import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "./logger.js";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, _res, next) =>
  next(new HttpError(404, "not_found", "Not found"));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: "validation_error", message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: { code: "internal", message: "Something went wrong" } });
};

/** Wrap async handlers so rejections reach the error handler (Express 4). */
export const ah =
  (fn: (...a: Parameters<RequestHandler>) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
