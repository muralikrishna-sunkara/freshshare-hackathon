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
  // Email for notifications: "ses" on AWS, "smtp" = Mailpit locally (its HTTP send API), "log" prints, "memory" for tests.
  EMAIL_TRANSPORT: z.enum(["ses", "smtp", "log", "memory", "off"]).default(process.env.NODE_ENV === "test" ? "memory" : "log"),
  EMAIL_FROM: z.string().default("FreshShare <notifications@freshshare.de>"),
  MAILPIT_URL: z.string().default("http://localhost:8025"),
  // Photon reverse geocoding for the public "91054 Altstadt" area label. "off" in tests.
  GEOCODER: z.enum(["photon", "off"]).default(process.env.NODE_ENV === "test" ? "off" : "photon"),
  PHOTON_URL: z.string().default("https://photon.komoot.io"),
  // Web push (T2.2): a P-256 private key as PEM (Terraform tls_private_key on AWS, `npm run vapid` locally).
  // Unset = push is off and the settings page says so. "memory" (tests) records pushes instead of sending them.
  VAPID_PRIVATE_KEY_PEM: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:notifications@freshshare.de"),
  PUSH_TRANSPORT: z.enum(["webpush", "memory"]).default(process.env.NODE_ENV === "test" ? "memory" : "webpush"),
  // K1 photo autofill: Anthropic API key and model. Unset or empty = the "Fill from photo" button is hidden.
  AI_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  AI_MODEL: z.string().default("claude-opus-5-5"),
});

export type Env = z.infer<typeof schema>;
export const env: Env = schema.parse(process.env);
