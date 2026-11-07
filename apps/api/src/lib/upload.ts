import multer from "multer";
import sharp from "sharp";
import { HttpError } from "./errors.js";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS = 4;

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS, fields: 40 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new HttpError(400, "unsupported_type", "Please upload a photo (JPEG, PNG, WebP or HEIC)"));
  },
});

/** Re-encode to max 1600 px WebP. sharp drops EXIF (including GPS) unless told to keep it. */
export async function toWebp(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    throw new HttpError(400, "invalid_image", "We couldn't read that photo, please try another one");
  }
}
