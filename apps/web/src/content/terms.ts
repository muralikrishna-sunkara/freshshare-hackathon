// Same text as the sign-up dialog on freshshare.food (checked 3 Nov 2026), from the kit's docs/TERMS.md.
export const TERMS_VERSION = "2026-11-03";

export interface TermsSection {
  heading: string;
  kind: "bullets" | "numbered";
  items: { title?: string; text: string }[];
}

export const TERMS_TITLE = "Food Sharing Etiquette & Community Guidelines";

export const TERMS: TermsSection[] = [
  {
    heading: "Our Core Values",
    kind: "bullets",
    items: [
      { title: "Honest", text: "Provide accurate information about food items, including expiration dates, storage conditions, and allergens." },
      { title: "Responsible", text: "Ensure food safety standards are met. Only share food that you would eat yourself." },
      { title: "Reliable", text: "Honor your commitments. Be punctual for pickups and communicate any changes promptly." },
    ],
  },
  {
    heading: "Food Donor Guidelines",
    kind: "numbered",
    items: [
      { title: "Food Quality & Safety", text: "Only donate food that is safe, fresh, and within expiration dates. Check for proper storage conditions and packaging integrity." },
      { title: "Accurate Descriptions", text: "Provide clear photos and descriptions. Include allergen information, ingredients, storage requirements, and preparation instructions." },
      { title: "Proper Packaging", text: "Package food items securely in clean, food-safe containers. Ensure proper sealing for transport." },
      { title: "Pickup Coordination", text: "Be available at agreed pickup times. Respond promptly to messages and provide clear pickup instructions." },
      { title: "Hygiene Standards", text: "Maintain clean preparation and storage areas. Follow basic food hygiene practices." },
    ],
  },
  {
    heading: "Food Recipient Guidelines",
    kind: "numbered",
    items: [
      { title: "Respectful Communication", text: "Be polite and respectful in all interactions. Express gratitude for donations received." },
      { title: "Punctual Pickup", text: "Arrive on time for scheduled pickups. Notify donors immediately if you cannot make it." },
      { title: "Only Claim What You Need", text: "Be considerate of others. Only claim food you will actually use to prevent waste." },
      { title: "Inspect Before Accepting", text: "Check food condition during pickup. Report any concerns immediately and politely." },
      { title: "Leave Feedback", text: "Provide honest reviews to help maintain community trust and quality standards." },
    ],
  },
  {
    heading: "Prohibited Items",
    kind: "bullets",
    items: [
      { text: "Expired or spoiled food items" },
      { text: "Food with broken seals or damaged packaging" },
      { text: "Home-canned goods without proper safety verification" },
      { text: "Food stored at unsafe temperatures" },
      { text: "Items with unknown ingredients or allergens" },
      { text: "Alcohol or controlled substances" },
      { text: "Pet food or animal feed (unless specifically designated)" },
      { text: "Raw meat, minced meat, raw fish, raw-egg dishes and raw-milk products (FreshShare food-safety rule)" },
    ],
  },
  {
    heading: "Legal Disclaimer",
    kind: "bullets",
    items: [
      { title: "Liability", text: "FreshShare is a platform connecting food donors and recipients. We do not inspect, verify, or guarantee the safety or quality of shared food items. Users participate at their own risk." },
      { title: "Food Safety", text: "All users must comply with local food safety regulations. Donors are responsible for ensuring food safety. Recipients are responsible for inspecting items before consumption." },
      { title: "Health Risks", text: "Consuming shared food carries inherent risks. Users with allergies, dietary restrictions, or health conditions should exercise extreme caution." },
      { title: "No Warranty", text: "FreshShare makes no warranties regarding the safety, quality, or fitness of shared food items for any particular purpose." },
    ],
  },
  {
    heading: "Community Standards",
    kind: "bullets",
    items: [
      { text: "Treat all community members with respect and kindness" },
      { text: "Communicate clearly and promptly" },
      { text: "Report any safety concerns or inappropriate behavior" },
      { text: "Honor your commitments and follow through on claims" },
      { text: "Maintain the reputation of our sharing community" },
      { text: "Help reduce food waste and support sustainability" },
    ],
  },
];

export const TERMS_FOOTNOTE =
  'By clicking "I Accept", you agree to follow these terms and conditions, guidelines, and community standards. Violations may result in account suspension or termination.';
