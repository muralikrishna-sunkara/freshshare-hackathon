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
});

export type Env = z.infer<typeof schema>;
export const env: Env = schema.parse(process.env);
