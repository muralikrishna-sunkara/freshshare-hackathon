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

export interface Me {
  id: string;
  name: string;
  email: string;
  homeLat: number;
  homeLng: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  stats: { shared: number; received: number };
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const fetchMe = () =>
  api<{ user: Me }>("/me")
    .then((r) => r.user)
    .catch((e) => {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    });

export const login = (email: string, password: string) => api<{ user: Me }>("/auth/login", json({ email, password })).then((r) => r.user);

export const register = (b: { name: string; email: string; password: string; homeLat: number; homeLng: number }) =>
  api<{ user: Me }>("/auth/register", json(b)).then((r) => r.user);

export const logout = () => fetch("/api/auth/logout", { method: "POST", credentials: "include" });

export type ClaimStatus = "pending" | "confirmed" | "collected" | "cancelled" | "lapsed";

export interface ListingDetail extends Listing {
  isMine: boolean;
  myClaim: { id: string; status: ClaimStatus } | null;
}

export const fetchListing = (id: string) => api<{ listing: ListingDetail }>(`/listings/${id}`).then((r) => r.listing);

export interface Claim {
  id: string;
  status: ClaimStatus;
  holdUntil: string;
  createdAt: string;
  role: "giver" | "receiver";
  listing: Listing;
  receiver: Giver;
  myRating: number | null;
}

export const reserveListing = (id: string) => api<{ claim: Claim }>(`/listings/${id}/claims`, { method: "POST" }).then((r) => r.claim);
export const fetchClaim = (id: string) => api<{ claim: Claim }>(`/claims/${id}`).then((r) => r.claim);
export const fetchMyClaims = () => api<{ asReceiver: Claim[]; asGiver: Claim[] }>("/claims");
export const claimAction = (id: string, action: "confirm" | "collected" | "cancel") =>
  api<{ claim: Claim }>(`/claims/${id}/${action}`, { method: "POST" }).then((r) => r.claim);

export const createListing = (form: FormData) => api<{ listing: Listing }>("/listings", { method: "POST", body: form }).then((r) => r.listing);
