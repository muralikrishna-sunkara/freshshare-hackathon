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
  fridge?: { id: string; name?: string; address?: string } | null;
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

export type FridgeKind = "fridge" | "pantry" | "dropoff";
export type FillLevel = "empty" | "low" | "half" | "full";

export interface Fridge {
  id: string;
  name: string;
  kind?: FridgeKind;
  address: string;
  lat: number;
  lng: number;
  openingHours: string;
  photoUrl: string | null;
  distanceM: number;
  lastCheckIn: { state: "stocked" | "empty" | "needs_cleaning"; fillLevel?: FillLevel | null; at: string } | null;
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
  emailNotifications: boolean;
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
  heldUntil: string | null;
  heldForMe: boolean;
  waitlist: { count: number; myPosition: number | null };
}

export type WaitlistStatus = ListingDetail["waitlist"];
export const joinWaitlist = (id: string) => api<{ waitlist: WaitlistStatus }>(`/listings/${id}/waitlist`, { method: "POST" }).then((r) => r.waitlist);
export const leaveWaitlist = (id: string) => api<{ waitlist: WaitlistStatus }>(`/listings/${id}/waitlist`, { method: "DELETE" }).then((r) => r.waitlist);

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
  /** Receiver only, once confirmed: show as QR code or digits; the giver enters it to complete the pickup. */
  pickupCode?: string;
}

export const verifyPickupCode = (id: string, code: string) => api<{ claim: Claim }>(`/claims/${id}/verify`, json({ code })).then((r) => r.claim);

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

export const updateProfile = (b: { name?: string; bio?: string | null; homeLat?: number; homeLng?: number; emailNotifications?: boolean }) =>
  api<{ user: Me }>("/me", { ...json(b), method: "PATCH" }).then((r) => r.user);

export interface PublicProfile {
  id: string;
  name: string;
  bio: string | null;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  memberSince: string;
  blockedByMe: boolean;
  stats: { shared: number; given: number; received: number };
  reviews: { id: string; stars: number; note: string | null; createdAt: string; from: { id: string; name: string } }[];
}
export const blockUser = (id: string) => api<{ blocked: true; cancelledPickups: number }>(`/users/${id}/block`, { method: "POST" });
export const unblockUser = (id: string) => api<{ blocked: false }>(`/users/${id}/block`, { method: "DELETE" });
export const fetchMyBlocks = () => api<{ blocked: { id: string; name: string }[] }>("/users/blocks/mine").then((r) => r.blocked);

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

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// Fridges
export interface FridgeDetail {
  id: string;
  name: string;
  kind: FridgeKind;
  description: string | null;
  address: string;
  lat: number;
  lng: number;
  openingHours: string;
  accessNotes: string | null;
  photoUrl: string | null;
  status: "pending" | "active" | "inactive" | "rejected";
  checkIns: { id: string; state: FridgeState; fillLevel: FillLevel | null; contents: string | null; at: string; by: { id: string; name: string } }[];
  listings: Listing[];
}
export const fetchFridge = (id: string) => api<{ fridge: FridgeDetail }>(`/fridges/${id}`).then((r) => r.fridge);
export const fridgeCheckIn = (id: string, fillLevel: FillLevel, contents?: string) =>
  api<{ message: string }>(`/fridges/${id}/checkins`, json({ fillLevel, contents }));
export const suggestFridge = (b: {
  name: string; kind: FridgeKind; description?: string; address: string; lat: number; lng: number; openingHours: string; accessNotes?: string;
}) => api<{ fridge: { id: string }; message: string }>("/fridges", json(b));

// Organizations
export type OrgType = "food_bank" | "ngo" | "charity" | "community_center" | "religious_org" | "other";
export type OrgRole = "admin" | "manager" | "volunteer" | "viewer";
export interface Organization {
  id: string; name: string; type: OrgType; website: string | null; email: string; city: string; address: string; lat: number; lng: number;
  description: string; mission: string | null; serviceArea: string | null; logoUrl: string | null; status: string; verified: boolean;
  myRole?: OrgRole | null;
}
export const fetchOrganizations = () => api<{ organizations: Organization[] }>("/organizations").then((r) => r.organizations);
export const fetchOrganization = (id: string) => api<{ organization: Organization }>(`/organizations/${id}`).then((r) => r.organization);
export const fetchMyOrgs = () => api<{ memberships: { role: OrgRole; organization: Organization }[] }>("/organizations/mine/all").then((r) => r.memberships);
export const registerOrganization = (form: FormData) =>
  api<{ organization: { id: string }; message: string }>("/organizations", { method: "POST", body: form });

export interface OrgDashboard {
  organization: Organization;
  members: { userId: string; name: string; email?: string; role: OrgRole; joinedAt: string }[];
  itemsCollected: number;
  bulkClaims: { id: string; name: string; status: BulkStatus; scheduledPickupDate: string; items: number; collected: number }[];
  documents: { id: string; filename: string; contentType: string; size: number }[];
}
export const fetchOrgDashboard = (id: string) => api<OrgDashboard>(`/organizations/${id}/dashboard`);
export const inviteMember = (id: string, email: string, role: OrgRole) => api<{ message: string }>(`/organizations/${id}/members`, json({ email, role }));
export const changeMemberRole = (id: string, userId: string, role: OrgRole) => api(`/organizations/${id}/members/${userId}`, send("PATCH", { role }));
export const removeMember = (id: string, userId: string) =>
  fetch(`/api/organizations/${id}/members/${userId}`, { method: "DELETE", credentials: "include" }).then(async (r) => {
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      throw new ApiError(r.status, b?.error?.code ?? "error", b?.error?.message ?? r.statusText);
    }
  });
export const fetchCandidates = (id: string, radius: number) =>
  api<{ listings: Listing[] }>(`/organizations/${id}/candidates?radius=${radius}`).then((r) => r.listings);

export type BulkStatus = "pending" | "in_progress" | "partially_completed" | "completed" | "cancelled";
export interface BulkClaim {
  id: string; name: string; notes: string | null; status: BulkStatus; scheduledPickupDate: string;
  organization: { id: string; name: string }; myRole: OrgRole;
  items: {
    id: string; claimId: string; claimStatus: ClaimStatus; isCollected: boolean; collectedAt: string | null;
    listing: { id: string; title: string; photoUrl: string; portions: number; pickupUntil: string; giver: { id: string; name: string }; distanceM: number; lat?: number; lng?: number; handoverSpot?: string | null };
  }[];
}
export const createBulkClaim = (orgId: string, b: { name: string; notes?: string; scheduledPickupDate: string; listingIds: string[] }) =>
  api<{ bulkClaim: { id: string }; skipped: string[] }>(`/organizations/${orgId}/bulk-claims`, json(b));
export const fetchBulkClaim = (id: string) => api<{ bulkClaim: BulkClaim }>(`/bulk-claims/${id}`).then((r) => r.bulkClaim);
export const collectBulkItem = (id: string, itemId: string) =>
  api<{ bulkClaim: BulkClaim }>(`/bulk-claims/${id}/items/${itemId}/collect`, { method: "POST" }).then((r) => r.bulkClaim);
export const cancelBulkClaim = (id: string) => api<{ bulkClaim: BulkClaim }>(`/bulk-claims/${id}/cancel`, { method: "POST" }).then((r) => r.bulkClaim);

// Admin
export interface AdminPending {
  fridges: (FridgeDetail & { createdAt: string; createdBy: { id: string; name?: string } | null })[];
  organizations: (Organization & {
    createdAt: string; contactName: string; registrationNumber: string | null; createdBy: { id: string; name?: string };
    documents: { id: string; filename: string; contentType: string; size: number }[];
  })[];
}
export const fetchAdminPending = () => api<AdminPending>("/admin/pending");
export const adminDecide = (kind: "fridges" | "organizations", id: string, decision: "approve" | "reject") =>
  api<{ status: string }>(`/admin/${kind}/${id}/${decision}`, { method: "POST" });

export interface AdminReport {
  id: string;
  reason: ReportReason;
  note: string | null;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; name: string };
  listing: { id: string; title: string; status: string; photoUrl: string; giverId: string } | null;
  reportedUser: { id: string; name: string } | null;
}
export const fetchAdminReports = (status: "open" | "resolved" = "open") => api<{ reports: AdminReport[] }>(`/admin/reports?status=${status}`);
export const resolveReport = (id: string, action: "dismiss" | "remove_listing" | "suspend_user", reason?: string) =>
  api<{ ok: true }>(`/admin/reports/${id}/resolve`, json({ action, reason }));
export interface SuspendedUser { id: string; name: string; suspendedAt: string; suspendedReason: string | null }
export const fetchSuspended = () => api<{ users: SuspendedUser[] }>("/admin/users/suspended").then((r) => r.users);
export const unsuspendUser = (id: string) => api<{ ok: true }>(`/admin/users/${id}/unsuspend`, { method: "POST" });

export interface EarlyAccessStats {
  total: number;
  byRole: { role: EarlyAccessRole; count: number }[];
  bySource: { source: string; count: number }[];
  latest: { id: string; email: string; role: EarlyAccessRole; postcode: string | null; source: string | null; createdAt: string }[];
}
export const fetchEarlyAccessStats = () => api<EarlyAccessStats>("/admin/early-access");

export type NotificationType =
  | "claim_received" | "claim_confirmed" | "claim_cancelled" | "new_message" | "listing_expiring_soon"
  | "new_listing_nearby" | "waitlist_offer" | "fridge_approved" | "org_approved";
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}
export const fetchNotifications = () => api<{ notifications: AppNotification[]; unreadCount: number }>("/notifications");
export const markNotificationRead = (id: string) => api<{ unreadCount: number }>(`/notifications/${id}/read`, { method: "POST" });
export const markAllNotificationsRead = () => api<{ unreadCount: number }>("/notifications/read-all", { method: "POST" });

export interface ImpactTotals4 {
  meals: number;
  kg: number;
  co2Kg: number;
  waterL: number;
  pickups: number;
}
export interface ImpactMonth {
  month: string;
  label: string;
  meals: number;
  kg: number;
}
export interface UserImpact {
  user: { id: string; name: string; memberSince: string };
  total: ImpactTotals4;
  given: ImpactTotals4;
  received: ImpactTotals4;
  listingsShared: number;
  fridgeCheckIns: number;
  monthly: ImpactMonth[];
  factors: { kgPerPortion: number; co2ePerKg: number; waterLitresPerKg: number };
}
export interface OrgImpact {
  organization: { id: string; name: string };
  total: ImpactTotals4;
  last12Months: ImpactTotals4;
  pickupRuns: number;
  giversHelped: number;
  categories: { category: Category; meals: number }[];
  monthly: ImpactMonth[];
  factors: { kgPerPortion: number; co2ePerKg: number; waterLitresPerKg: number };
}
export const fetchUserImpact = (id: string) => api<UserImpact>(`/impact/users/${id}`);
export const fetchOrgImpact = (id: string) => api<OrgImpact>(`/impact/organizations/${id}`);
