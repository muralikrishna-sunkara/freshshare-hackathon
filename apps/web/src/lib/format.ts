import { locale, t } from "../i18n";
import type { BulkStatus, Category, DietaryTag, FillLevel, FridgeKind, Origin, OrgRole, OrgType, ReportReason } from "../api/client";

export const CATEGORY: Record<Category, { label: string; color: string; emoji: string }> = {
  leftovers: { label: t("Leftovers"), color: "#d9a23c", emoji: "🍲" },
  fruit_veg: { label: t("Fruit & veg"), color: "#2e5e4e", emoji: "🥕" },
  bread: { label: t("Bread"), color: "#b7853f", emoji: "🍞" },
  packaged: { label: t("Packaged"), color: "#5b7db1", emoji: "📦" },
  dairy: { label: t("Dairy"), color: "#8e6bb8", emoji: "🥛" },
  other: { label: t("Other"), color: "#78716c", emoji: "🍽️" },
};

export const ORIGIN: Record<Origin, string> = {
  homemade: t("Homemade"),
  packaged: t("Packaged"),
  fresh_produce: t("Fresh produce"),
};

export const formatDistance = (m?: number) => (m === undefined ? "" : m < 1000 ? `${m} m` : `${Number((m / 1000).toFixed(1))} km`);

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return t("just now");
  if (min < 60) return t("{n} min ago", { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return t("{n} h ago", { n: h });
  return t("{n} d ago", { n: Math.round(h / 24) });
}

export const allergenLabel = (a: string) => { const l = t(a); return l.charAt(0).toUpperCase() + l.slice(1); };

export const DIETARY: Record<DietaryTag, string> = {
  vegetarian: t("Vegetarian"),
  vegan: t("Vegan"),
  gluten_free: t("Gluten-free"),
  lactose_free: t("Lactose-free"),
  halal: t("Halal"),
  kosher: t("Kosher"),
  nut_free: t("Nut-free"),
};

export const REPORT_REASON: Record<ReportReason, string> = {
  unsafe_food: t("Unsafe food"),
  prohibited_item: t("Prohibited item"),
  spam: t("Spam"),
  no_show: t("No-show"),
  harassment: t("Harassment"),
  other: t("Other"),
};

/** "3 h left", "45 min left" or "ended" until the end of the pickup window. */
export function timeLeft(iso: string, now = Date.now()): string {
  const min = Math.round((new Date(iso).getTime() - now) / 60000);
  if (min <= 0) return t("pickup ended");
  if (min < 60) return t("{n} min left", { n: min });
  const h = Math.round(min / 60);
  return h < 48 ? t("{n} h left", { n: h }) : t("{n} days left", { n: Math.round(h / 24) });
}

export const FRIDGE_KIND: Record<FridgeKind, { label: string; emoji: string }> = {
  fridge: { label: t("Community fridge"), emoji: "" }, // rendered with <FridgeIcon />
  pantry: { label: t("Pantry shelf"), emoji: "🥫" },
  dropoff: { label: t("Drop-off point"), emoji: "📦" },
};

export const FILL: Record<FillLevel, { label: string; tone: string }> = {
  empty: { label: t("Empty"), tone: "bg-stone-100 text-stone-700" },
  low: { label: t("Low"), tone: "bg-accent-light text-accent-dark" },
  half: { label: t("Half full"), tone: "bg-brand-light text-brand-dark" },
  full: { label: t("Full"), tone: "bg-brand-light text-brand-dark" },
};

export const ORG_TYPE: Record<OrgType, string> = {
  food_bank: t("Food bank"),
  ngo: t("NGO"),
  charity: t("Charity"),
  community_center: t("Community center"),
  religious_org: t("Religious organization"),
  other: t("Other"),
};

export const ORG_ROLE: Record<OrgRole, { label: string; help: string }> = {
  admin: { label: t("Admin"), help: t("Manages the team and settings") },
  manager: { label: t("Manager"), help: t("Creates pickup runs (bulk claims)") },
  volunteer: { label: t("Volunteer"), help: t("Collects items on a run") },
  viewer: { label: t("Viewer"), help: t("Can look, not change") },
};

export const BULK_STATUS: Record<BulkStatus, { label: string; tone: string }> = {
  pending: { label: t("Waiting for givers"), tone: "bg-accent-light text-accent-dark" },
  in_progress: { label: t("In progress"), tone: "bg-brand-light text-brand-dark" },
  partially_completed: { label: t("Partially collected"), tone: "bg-brand-light text-brand-dark" },
  completed: { label: t("Completed"), tone: "bg-brand text-white" },
  cancelled: { label: t("Cancelled"), tone: "bg-stone-100 text-stone-600" },
};

export const EARLY_ROLE: Record<string, string> = {
  giver: t("Givers"),
  receiver: t("Receivers"),
  business: t("Shops & cafés"),
  fridge_host: t("Fridge hosts"),
  organization: t("Food banks & NGOs"),
};
