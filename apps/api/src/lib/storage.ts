import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  publicUrl(key: string): string;
}

const trim = (s: string) => s.replace(/\/+$/, "");

export function localStorage(dir = env.UPLOADS_DIR, baseUrl = env.PUBLIC_IMAGE_BASE_URL ?? "/uploads"): Storage {
  return {
    publicUrl: (key) => `${trim(baseUrl)}/${key}`,
    async put(key, body) {
      const file = path.resolve(dir, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
      return this.publicUrl(key);
    },
  };
}

export function s3Storage(): Storage {
  if (!env.S3_BUCKET || !env.PUBLIC_IMAGE_BASE_URL) {
    throw new Error("STORAGE_DRIVER=s3 needs S3_BUCKET and PUBLIC_IMAGE_BASE_URL");
  }
  const bucket = env.S3_BUCKET;
  const base = trim(env.PUBLIC_IMAGE_BASE_URL);
  // Credentials come from the ECS task role via the default provider chain.
  const client = new S3Client({ region: env.AWS_REGION });
  return {
    publicUrl: (key) => `${base}/${key}`,
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000" }),
      );
      return this.publicUrl(key);
    },
  };
}

let instance: Storage | undefined;
export function storage(): Storage {
  instance ??= env.STORAGE_DRIVER === "s3" ? s3Storage() : localStorage();
  return instance;
}
