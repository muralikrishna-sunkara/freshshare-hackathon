/** Product rule: no raw meat or fish in the MVP (English + common German terms). */
const RAW_MEAT_FISH =
  /\b(raw|uncooked|fresh)\s+(meat|fish|chicken|pork|beef|lamb|turkey|seafood|prawns?|shrimps?)\b|\bmince(d)?\b|\bground (beef|pork|meat)\b|\b(chicken|turkey) breasts?\b|\bsteaks?\b|\b(salmon|tuna|cod|fish) fillets?\b|\bsushi\b|\bsashimi\b|\btartare\b|hackfleisch|\bhack\b|rohes? (fleisch|fisch)|\bmett\b/i;

export const isRawMeatOrFish = (...texts: (string | null | undefined)[]) => texts.some((t) => !!t && RAW_MEAT_FISH.test(t));

export const RAW_MEAT_MESSAGE =
  "Raw meat and fish can't be shared on FreshShare yet. Cooked dishes are welcome when labelled Homemade.";

/** Homemade food leaves the map 48 h after posting, even if its best-before date is later. */
export const HOMEMADE_MAX_HOURS = 48;

/** Version of the Terms & Conditions text a user accepts at sign-up (docs/TERMS.md in the kit). */
export const TERMS_VERSION = "2026-11-03";

/** Emails ending here are test accounts and are left out of public stats. */
export const TEST_EMAIL_SUFFIX = "@example.test";

export const DIETARY_TAGS = ["vegetarian", "vegan", "gluten_free", "lactose_free", "halal", "kosher", "nut_free"] as const;
export const REPORT_REASONS = ["unsafe_food", "prohibited_item", "spam", "no_show", "harassment", "other"] as const;
export const CATEGORIES = ["leftovers", "fruit_veg", "bread", "packaged", "dairy", "other"] as const;
export const ORIGINS = ["homemade", "packaged", "fresh_produce"] as const;
/** Allergen chips on the share form (a subset of the EU 14). */
export const ALLERGENS = ["gluten", "milk", "eggs", "nuts", "peanuts", "soy", "sesame", "celery", "mustard", "fish"] as const;
