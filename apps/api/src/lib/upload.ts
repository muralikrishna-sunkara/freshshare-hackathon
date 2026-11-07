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

export const MAX_DOC_BYTES = 10 * 1024 * 1024;
const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/** Organization verification documents: PDF, JPG or PNG up to 10 MB. Kept in memory and stored privately. */
export const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_BYTES, files: 1, fields: 30 },
  fileFilter: (_req, file, cb) => {
    if (DOC_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "unsupported_type", "Documents must be PDF, JPG or PNG"));
  },
});

/** Check the file really starts like a PDF/JPEG/PNG, not just its declared type. */
export function sniffDoc(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}
