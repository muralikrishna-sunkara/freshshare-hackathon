import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { setPhotoSuggester, suggestionSchema, type PhotoSuggestion } from "../src/services/ai.js";
import { loginAs, photoPath, seedDb } from "./helpers.js";

const app = createApp();
let anna: TestAgent;
const apples: PhotoSuggestion = {
  isFood: true,
  title: "Bag of apples, about 1 kg",
  category: "fruit_veg",
  origin: "fresh_produce",
  dietaryTags: ["vegan", "vegetarian"],
  allergens: [],
  rawMeatOrFish: false,
};

beforeAll(async () => {
  await seedDb();
  anna = await loginAs(app, "anna");
});
afterEach(() => setPhotoSuggester(null));
afterAll(() => prisma.$disconnect());

describe("K1 photo autofill", () => {
  it("is off without an API key, so the button stays hidden", async () => {
    expect((await request(app).get("/api/ai/status")).body).toEqual({ photoAutofill: false });
    const res = await anna.post("/api/ai/photo-suggestions").attach("photo", photoPath);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("ai_disabled");
  });

  it("returns the suggested fields and sends a shrunken JPEG", async () => {
    let sent: Buffer | null = null;
    setPhotoSuggester(async (jpeg) => {
      sent = jpeg;
      return apples;
    });
    expect((await request(app).get("/api/ai/status")).body).toEqual({ photoAutofill: true });
    const res = await anna.post("/api/ai/photo-suggestions").attach("photo", photoPath);
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toEqual({ title: "Bag of apples, about 1 kg", category: "fruit_veg", origin: "fresh_produce", dietaryTags: ["vegan", "vegetarian"], allergens: [] });
    expect(sent!.subarray(0, 2).toString("hex")).toBe("ffd8"); // JPEG
  });

  it("needs a signed-in user and a photo", async () => {
    setPhotoSuggester(async () => apples);
    expect((await request(app).post("/api/ai/photo-suggestions")).status).toBe(401);
    expect((await anna.post("/api/ai/photo-suggestions")).body.error.code).toBe("photo_required");
  });

  it("refuses raw meat and non-food photos", async () => {
    setPhotoSuggester(async () => ({ ...apples, title: "Raw chicken breasts", rawMeatOrFish: true }));
    expect((await anna.post("/api/ai/photo-suggestions").attach("photo", photoPath)).body.error.code).toBe("raw_meat_fish");
    setPhotoSuggester(async () => ({ ...apples, isFood: false }));
    expect((await anna.post("/api/ai/photo-suggestions").attach("photo", photoPath)).body.error.code).toBe("not_food");
  });

  it("turns a failed or malformed model reply into a plain error", async () => {
    setPhotoSuggester(async () => {
      throw new Error("529 overloaded");
    });
    const res = await anna.post("/api/ai/photo-suggestions").attach("photo", photoPath);
    expect(res.status).toBe(502);
    expect(res.body.error.message).toMatch(/fill in the details yourself/);
    setPhotoSuggester(async () => suggestionSchema.parse({ ...apples, category: "meat" }));
    expect((await anna.post("/api/ai/photo-suggestions").attach("photo", photoPath)).status).toBe(502);
  });
});
