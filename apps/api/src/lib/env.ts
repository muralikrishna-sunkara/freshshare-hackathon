import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1).default("dev-only-change-me"),
  APP_URL: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOADS_DIR: z.string().default("uploads"),
  S3_BUCKET: z.string().optional(),
  PUBLIC_IMAGE_BASE_URL: z.string().optional(),
  AWS_REGION: z.string().default("eu-central-1"),
  SNS_NOTIFICATIONS_ARN: z.string().optional(),
  LOG_LEVEL: z.string().default("info"),
  // Photon reverse geocoding for the public "91054 Altstadt" area label. "off" in tests.
  GEOCODER: z.enum(["photon", "off"]).default(process.env.NODE_ENV === "test" ? "off" : "photon"),
  PHOTON_URL: z.string().default("https://photon.komoot.io"),
});

export type Env = z.infer<typeof schema>;
export const env: Env = schema.parse(process.env);
