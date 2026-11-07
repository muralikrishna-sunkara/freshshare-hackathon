export type Category = "leftovers" | "fruit_veg" | "bread" | "packaged" | "dairy" | "other";
export type Origin = "homemade" | "packaged" | "fresh_produce";
export type DietaryTag = "vegetarian" | "vegan" | "gluten_free" | "lactose_free" | "halal" | "kosher" | "nut_free";

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
  photos: string[];
  dietaryTags: DietaryTag[];
  weightKg: number | null;
  areaLabel: string | null;
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

export const fetchNearby = (lat: number, lng: number, radius: number, category?: Category, diet?: DietaryTag) => {
  const q = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) });
  if (category) q.set("category", category);
  if (diet) q.set("diet", diet);
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
  bio: string | null;
  role: "user" | "admin";
  termsVersion: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  stats: { shared: number; given: number; received: number };
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

export const register = (b: {
  name: string;
  email: string;
  password: string;
  homeLat: number;
  homeLng: number;
  ageConfirmed: boolean;
  termsAccepted: boolean;
}) =>
  api<{ user: Me }>("/auth/register", json(b)).then((r) => r.user);

export const logout = () => fetch("/api/auth/logout", { method: "POST", credentials: "include" });

export type ClaimStatus = "pending" | "confirmed" | "collected" | "cancelled" | "lapsed" | "declined";

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
export const claimAction = (id: string, action: "confirm" | "collected" | "cancel" | "decline") =>
  api<{ claim: Claim }>(`/claims/${id}/${action}`, { method: "POST" }).then((r) => r.claim);

export const createListing = (form: FormData) => api<{ listing: Listing }>("/listings", { method: "POST", body: form }).then((r) => r.listing);

export const rateClaim = (id: string, stars: number, note?: string) =>
  api<{ claim: Claim }>(`/claims/${id}/ratings`, json({ stars, note })).then((r) => r.claim);

// DEMO verification endpoints (code 123456)
export const verifyPhone = (phone: string, code: string) => api<{ user: Me }>("/me/verify-phone", json({ phone, code })).then((r) => r.user);
export const verifyEmail = () => api<{ user: Me }>("/me/verify-email", { method: "POST" }).then((r) => r.user);

export interface Message {
  id: string;
  claimId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export const fetchMessages = (claimId: string, after?: string) =>
  api<{ messages: Message[] }>(`/claims/${claimId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`).then((r) => r.messages);
export const sendMessage = (claimId: string, body: string) =>
  api<{ message: Message }>(`/claims/${claimId}/messages`, json({ body })).then((r) => r.message);

export type FridgeState = "stocked" | "empty" | "needs_cleaning";
export const checkInFridge = (id: string, state: FridgeState) => api(`/fridges/${id}/checkins`, json({ state }));

export interface Impact {
  week: { portions: number; kg: number };
  me: { portionsGiven: number; portionsReceived: number; kg: number } | null;
}
export const fetchImpact = (lat: number, lng: number, radius: number) =>
  api<Impact>(`/impact?${new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) })}`);

export const updateProfile = (b: { name?: string; bio?: string | null; homeLat?: number; homeLng?: number }) =>
  api<{ user: Me }>("/me", { ...json(b), method: "PATCH" }).then((r) => r.user);

export interface PublicProfile {
  id: string;
  name: string;
  bio: string | null;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  memberSince: string;
  stats: { shared: number; given: number; received: number };
  reviews: { id: string; stars: number; note: string | null; createdAt: string; from: { id: string; name: string } }[];
}
export const fetchPublicProfile = (id: string) => api<{ user: PublicProfile }>(`/users/${id}`).then((r) => r.user);

export type EarlyAccessRole = "giver" | "receiver" | "business" | "fridge_host" | "organization";
export const joinEarlyAccess = (b: { email: string; role: EarlyAccessRole; postcode?: string; source?: string; language?: string; consent: boolean }) =>
  api<{ ok: true }>("/early-access", json(b));

export interface ImpactTotals {
  meals: number;
  kgSaved: number;
  co2Kg: number;
  neighbours: number;
  fridges: number;
  organizations: number;
}
export const fetchImpactTotals = () => api<ImpactTotals>("/impact/totals");

export type ReportReason = "unsafe_food" | "prohibited_item" | "spam" | "no_show" | "harassment" | "other";
export const report = (b: { listingId?: string; userId?: string; reason: ReportReason; note?: string }) =>
  api<{ ok: true; message: string }>("/reports", json(b));

export interface MyListing extends Listing {
  handoverSpot: string | null;
}
export const fetchMyListings = () => api<{ listings: MyListing[] }>("/listings/mine/all").then((r) => r.listings);
