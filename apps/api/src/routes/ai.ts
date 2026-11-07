import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { ah, HttpError } from "../lib/errors.js";
import { aiLimiter } from "../lib/rateLimit.js";
import { photoUpload } from "../lib/upload.js";
import { photoAutofillEnabled, suggestFromPhoto } from "../services/ai.js";
import { isRawMeatOrFish, RAW_MEAT_MESSAGE } from "../services/rules.js";

export const ai = Router();

/** Tells the share form whether to show "Fill from photo". */
ai.get("/status", (_req, res) => {
  res.json({ photoAutofill: photoAutofillEnabled() });
});

/** K1: the first listing photo in, suggested title, category, label, dietary tags and allergens out. Nothing is stored. */
ai.post(
  "/photo-suggestions",
  requireAuth,
  aiLimiter,
  photoUpload.single("photo"),
  ah(async (req, res) => {
    if (!req.file) throw new HttpError(400, "photo_required", "Add a photo first");
    const s = await suggestFromPhoto(req.file.buffer);
    if (!s.isFood) throw new HttpError(422, "not_food", "That doesn't look like food. Try another photo or fill in the details yourself.");
    if (s.rawMeatOrFish || isRawMeatOrFish(s.title)) throw new HttpError(422, "raw_meat_fish", RAW_MEAT_MESSAGE);
    const { isFood: _f, rawMeatOrFish: _r, ...suggestion } = s;
    res.json({ suggestion });
  }),
);
