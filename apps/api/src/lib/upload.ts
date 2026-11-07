import multer from "multer";
import sharp from "sharp";
import { HttpError } from "./errors.js";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 30 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new HttpError(400, "unsupported_type", "Please upload a photo (JPEG, PNG, WebP or HEIC)"));
  },
});

/** Re-encode to max 1024 px WebP. sharp drops EXIF (including GPS) unless told to keep it. */
export async function toWebp(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    throw new HttpError(400, "invalid_image", "We couldn't read that photo, please try another one");
  }
}
