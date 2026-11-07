/** Product rule: no raw meat or fish in the MVP (English + common German terms). */
const RAW_MEAT_FISH =
  /\b(raw|uncooked|fresh)\s+(meat|fish|chicken|pork|beef|lamb|turkey|seafood|prawns?|shrimps?)\b|\bmince(d)?\b|\bground (beef|pork|meat)\b|\b(chicken|turkey) breasts?\b|\bsteaks?\b|\b(salmon|tuna|cod|fish) fillets?\b|\bsushi\b|\bsashimi\b|\btartare\b|hackfleisch|\bhack\b|rohes? (fleisch|fisch)|\bmett\b/i;

export const isRawMeatOrFish = (...texts: (string | null | undefined)[]) => texts.some((t) => !!t && RAW_MEAT_FISH.test(t));

export const RAW_MEAT_MESSAGE =
  "Raw meat and fish can't be shared on FreshShare yet. Cooked dishes are welcome when labelled Homemade.";

/** Homemade food leaves the map 48 h after posting, even if its best-before date is later. */
export const HOMEMADE_MAX_HOURS = 48;
