export type Category = "leftovers" | "fruit_veg" | "bread" | "packaged" | "dairy" | "other";
export type Origin = "homemade" | "packaged" | "fresh_produce";

export interface Giver {
  id: string;
  name: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
}

export interface Listing {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  origin: Origin;
  allergens: string[];
  bestBefore: string;
  photoUrl: string;
  publicLat: number;
  publicLng: number;
  pickupFrom: string;
  pickupUntil: string;
  portions: number;
  status: string;
  createdAt: string;
  hasHandoverSpot: boolean;
  distanceM?: number;
  giver: Giver;
  lat?: number;
  lng?: number;
  handoverSpot?: string | null;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? "error", body?.error?.message ?? res.statusText);
  return body as T;
}

export const fetchNearby = (lat: number, lng: number, radius: number, category?: Category) => {
  const q = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) });
  if (category) q.set("category", category);
  return api<{ listings: Listing[] }>(`/listings?${q}`).then((r) => r.listings);
};

export interface Fridge {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  openingHours: string;
  photoUrl: string | null;
  distanceM: number;
  lastCheckIn: { state: "stocked" | "empty" | "needs_cleaning"; at: string } | null;
}

export const fetchFridges = (lat: number, lng: number, radius: number) =>
  api<{ fridges: Fridge[] }>(`/fridges?${new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) })}`).then(
    (r) => r.fridges,
  );
