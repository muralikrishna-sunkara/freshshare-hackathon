import type { Category, Origin } from "../api/client";

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
