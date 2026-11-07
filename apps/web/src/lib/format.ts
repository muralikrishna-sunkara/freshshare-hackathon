import type { BulkStatus, Category, DietaryTag, FillLevel, FridgeKind, Origin, OrgRole, OrgType, ReportReason } from "../api/client";

export const CATEGORY: Record<Category, { label: string; color: string; emoji: string }> = {
  leftovers: { label: "Leftovers", color: "#d9a23c", emoji: "🍲" },
  fruit_veg: { label: "Fruit & veg", color: "#2e5e4e", emoji: "🥕" },
  bread: { label: "Bread", color: "#b7853f", emoji: "🍞" },
  packaged: { label: "Packaged", color: "#5b7db1", emoji: "📦" },
  dairy: { label: "Dairy", color: "#8e6bb8", emoji: "🥛" },
  other: { label: "Other", color: "#78716c", emoji: "🍽️" },
};

export const ORIGIN: Record<Origin, string> = {
  homemade: "Homemade",
  packaged: "Packaged",
  fresh_produce: "Fresh produce",
};

export const formatDistance = (m?: number) => (m === undefined ? "" : m < 1000 ? `${m} m` : `${Number((m / 1000).toFixed(1))} km`);

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export const allergenLabel = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);

export const DIETARY: Record<DietaryTag, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  lactose_free: "Lactose-free",
  halal: "Halal",
  kosher: "Kosher",
  nut_free: "Nut-free",
};

export const REPORT_REASON: Record<ReportReason, string> = {
  unsafe_food: "Unsafe food",
  prohibited_item: "Prohibited item",
  spam: "Spam",
  no_show: "No-show",
  harassment: "Harassment",
  other: "Other",
};

/** "3 h left", "45 min left" or "ended" until the end of the pickup window. */
export function timeLeft(iso: string, now = Date.now()): string {
  const min = Math.round((new Date(iso).getTime() - now) / 60000);
  if (min <= 0) return "pickup ended";
  if (min < 60) return `${min} min left`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h left` : `${Math.round(h / 24)} days left`;
}

export const FRIDGE_KIND: Record<FridgeKind, { label: string; emoji: string }> = {
  fridge: { label: "Community fridge", emoji: "🧊" },
  pantry: { label: "Pantry shelf", emoji: "🥫" },
  dropoff: { label: "Drop-off point", emoji: "📦" },
};

export const FILL: Record<FillLevel, { label: string; tone: string }> = {
  empty: { label: "Empty", tone: "bg-stone-100 text-stone-700" },
  low: { label: "Low", tone: "bg-accent-light text-accent-dark" },
  half: { label: "Half full", tone: "bg-brand-light text-brand-dark" },
  full: { label: "Full", tone: "bg-brand-light text-brand-dark" },
};

export const ORG_TYPE: Record<OrgType, string> = {
  food_bank: "Food bank",
  ngo: "NGO",
  charity: "Charity",
  community_center: "Community center",
  religious_org: "Religious organization",
  other: "Other",
};

export const ORG_ROLE: Record<OrgRole, { label: string; help: string }> = {
  admin: { label: "Admin", help: "Manages the team and settings" },
  manager: { label: "Manager", help: "Creates pickup runs (bulk claims)" },
  volunteer: { label: "Volunteer", help: "Collects items on a run" },
  viewer: { label: "Viewer", help: "Can look, not change" },
};

export const BULK_STATUS: Record<BulkStatus, { label: string; tone: string }> = {
  pending: { label: "Waiting for givers", tone: "bg-accent-light text-accent-dark" },
  in_progress: { label: "In progress", tone: "bg-brand-light text-brand-dark" },
  partially_completed: { label: "Partially collected", tone: "bg-brand-light text-brand-dark" },
  completed: { label: "Completed", tone: "bg-brand text-white" },
  cancelled: { label: "Cancelled", tone: "bg-stone-100 text-stone-600" },
};

export const EARLY_ROLE: Record<string, string> = {
  giver: "Givers",
  receiver: "Receivers",
  business: "Shops & cafés",
  fridge_host: "Fridge hosts",
  organization: "Food banks & NGOs",
};
