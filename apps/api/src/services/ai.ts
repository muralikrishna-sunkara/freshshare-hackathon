import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import { z as z4 } from "zod/v4";
import { z } from "zod";
import { env } from "../lib/env.js";
import { HttpError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { ALLERGENS, CATEGORIES, DIETARY_TAGS, ORIGINS } from "./rules.js";

/** What the create form can fill in. The giver checks and edits everything before posting. */
export const suggestionSchema = z.object({
  isFood: z.boolean(),
  title: z.string().trim().max(80),
  category: z.enum(CATEGORIES),
  origin: z.enum(ORIGINS),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)).max(DIETARY_TAGS.length),
  allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length),
  rawMeatOrFish: z.boolean(),
});
export type PhotoSuggestion = z.infer<typeof suggestionSchema>;

// Same shape for structured outputs (the SDK helper takes a zod v4 schema). The reply is validated again with the
// app's own schema above, so a model or SDK change can never put an unknown value into the form.
const outputSchema = z4.object({
  isFood: z4.boolean().describe("false if the photo does not show food or drink"),
  title: z4.string().describe("Short listing title as a neighbour would write it, with the amount if visible, max 60 characters, e.g. 'Bag of apples, about 1 kg'"),
  category: z4.enum(CATEGORIES),
  origin: z4.enum(ORIGINS).describe("homemade = cooked at home, packaged = shop packaging, fresh_produce = fruit, veg, herbs"),
  dietaryTags: z4.array(z4.enum(DIETARY_TAGS)).describe("Only tags that are clearly true from the photo or label"),
  allergens: z4.array(z4.enum(ALLERGENS)).describe("Allergens that are likely present (EU list subset)"),
  rawMeatOrFish: z4.boolean().describe("true if it is raw or uncooked meat, poultry, fish or seafood"),
});

const SYSTEM = `You help people in Germany share spare food with neighbours on FreshShare.
Look at the photo of food someone wants to give away and suggest the listing fields.
Be conservative: leave a dietary tag out unless it is clearly true, and include an allergen when it is likely present.
Packaging may be in German. Write the title in English.`;

export type PhotoSuggester = (jpeg: Buffer) => Promise<PhotoSuggestion>;

let client: Anthropic | null = null;
const claudeSuggester: PhotoSuggester = async (jpeg) => {
  client ??= new Anthropic({ apiKey: env.AI_API_KEY, timeout: 30_000, maxRetries: 1 });
  const msg = await client.beta.messages.parse({
    model: env.AI_MODEL,
    max_tokens: 2000,
    // A short look-and-label task: low effort keeps the wait short.
    output_config: { effort: "low", format: betaZodOutputFormat(outputSchema) },
    // If the model declines (safety classifier), the API retries on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
          { type: "text", text: "Suggest the listing fields for this food." },
        ],
      },
    ],
  });
  if (msg.stop_reason === "refusal") throw new Error("model declined the photo");
  return suggestionSchema.parse(msg.parsed_output);
};

let override: PhotoSuggester | null = null;
/** Tests swap in a fake so no request leaves the machine. */
export function setPhotoSuggester(fn: PhotoSuggester | null) {
  override = fn;
}

export const photoAutofillEnabled = () => !!override || !!env.AI_API_KEY;

/** Shrink and re-encode (drops EXIF/GPS) before the photo leaves our servers, then ask the vision model. */
export async function suggestFromPhoto(input: Buffer): Promise<PhotoSuggestion> {
  if (!photoAutofillEnabled()) throw new HttpError(503, "ai_disabled", "Photo autofill isn't switched on here");
  let jpeg: Buffer;
  try {
    jpeg = await sharp(input).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    throw new HttpError(400, "invalid_image", "We couldn't read that photo, please try another one");
  }
  try {
    return await (override ?? claudeSuggester)(jpeg);
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, "photo autofill failed");
    throw new HttpError(502, "ai_failed", "We couldn't read the photo just now. Please fill in the details yourself.");
  }
}
