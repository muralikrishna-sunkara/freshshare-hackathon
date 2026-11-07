import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import {
  ApiError, cancelBulkClaim, changeMemberRole, collectBulkItem, createBulkClaim, fetchBulkClaim, fetchCandidates, fetchOrganization,
  fetchOrganizations, fetchOrgDashboard, inviteMember, registerOrganization, removeMember, type OrgRole, type OrgType,
} from "../api/client";
import { LocationPicker } from "../components/LocationPicker";
import { OrgImpactPanel } from "../components/ImpactPanel";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { Empty, Skeleton, Success } from "../components/States";
import { DEMO_CENTRE } from "../hooks/useLocation";
import { BULK_STATUS, formatDay, formatDistance, formatTime, ORG_ROLE, ORG_TYPE } from "../lib/format";

const orgIcon = L.divIcon({
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<div style="width:30px;height:30px;border-radius:50%;background:#1f4337;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px">🤝</div>`,
});

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function NotFoundNote({ error, what }: { error: unknown; what: string }) {
  const notFound = error instanceof ApiError && error.status === 404;
  return <Empty title={notFound ? `This ${what} doesn't exist or you don't have access.` : `Couldn't load this ${what}.`} action={{ to: "/organizations", label: "All organizations" }} />;
}

/** /organizations: directory of approved organizations. */
export function OrganizationsPage() {
  const q = useQuery({ queryKey: ["organizations"], queryFn: fetchOrganizations });
  return (
    <Page title="Organizations" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-stone-600">Food banks, NGOs and community centers that collect surplus on FreshShare.</p>
        <Link to="/organizations/new" className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white">Register an organization</Link>
      </div>
      {q.isLoading && <Skeleton rows={3} />}
      <ErrorNote error={q.error} />
      {q.data?.length === 0 && <Empty title="No organizations yet" action={{ to: "/organizations/new", label: "Register yours" }} />}
      <div className="grid gap-3 md:grid-cols-2">
        {q.data?.map((o) => (
          <Link key={o.id} to={`/organizations/${o.id}`} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200 hover:ring-brand">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-light text-2xl font-bold text-brand-dark">{o.name.charAt(0)}</span>
            <div className="min-w-0">
              <p className="font-bold">{o.name} {o.verified && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Verified</span>}</p>
              <p className="text-sm text-stone-600">{ORG_TYPE[o.type]} · {o.city}</p>
              {o.mission && <p className="mt-1 line-clamp-2 text-sm text-stone-700">{o.mission}</p>}
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}

/** /organizations/:id: public profile (members also see pending ones). */
export function OrganizationPage() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["organization", id], queryFn: () => fetchOrganization(id) });
  if (q.isLoading) return <Page title="Organization"><Skeleton rows={2} className="h-32" /></Page>;
  if (!q.data) return <Page title="Organization"><NotFoundNote error={q.error} what="organization" /></Page>;
  const o = q.data;
  return (
    <Page title={o.name} wide>
      {o.status !== "approved" && (
        <p className="mb-4 rounded-xl bg-accent-light p-3 text-sm text-accent-dark">Waiting for approval. Only your team and our admins can see this page.</p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <p className="text-sm font-semibold text-brand-dark">{ORG_TYPE[o.type]} · {o.city} {o.verified && "· ✔ Verified"}</p>
            <p className="text-stone-700">{o.description}</p>
            {o.mission && <p><strong>Mission:</strong> {o.mission}</p>}
            {o.serviceArea && <p><strong>Service area:</strong> {o.serviceArea}</p>}
            <p className="text-sm">
              <a className="font-semibold text-brand-dark underline" href={`mailto:${o.email}`}>{o.email}</a>
              {o.website && <> · <a className="font-semibold text-brand-dark underline" href={o.website} target="_blank" rel="noreferrer">Website</a></>}
            </p>
          </section>
          {o.myRole && (
            <Link to={`/organizations/${o.id}/dashboard`} className={`${primaryBtn} flex items-center justify-center`}>
              Open team dashboard ({ORG_ROLE[o.myRole].label})
            </Link>
          )}
        </div>
        <div className="h-64 overflow-hidden rounded-2xl ring-1 ring-stone-200 lg:h-80">
          <MapContainer center={[o.lat, o.lng]} zoom={14} className="h-full w-full" zoomControl={false}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[o.lat, o.lng]} icon={orgIcon} />
          </MapContainer>
        </div>
      </div>
      <div className="mt-6">
        <OrgImpactPanel orgId={o.id} member={!!o.myRole} />
      </div>
    </Page>
  );
}

/** /organizations/new: register. Pending until approved; creator becomes org admin. */
export function RegisterOrganizationPage() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", type: "" as OrgType | "", email: "", website: "", address: "", city: "", description: "", mission: "", serviceArea: "", contactName: "", registrationNumber: "" });
  const [pin, setPin] = useState(DEMO_CENTRE);
  const [doc, setDoc] = useState<File | null>(null);
  const [docErr, setDocErr] = useState<string>();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: () => {
      const form = new FormData();
      for (const [k, v] of Object.entries(f)) if (v) form.set(k, v);
      form.set("lat", String(pin.lat));
      form.set("lng", String(pin.lng));
      if (doc) form.set("document", doc);
      return registerOrganization(form);
    },
    onSuccess: (r) => nav(`/organizations/${r.organization.id}/dashboard?registered=1`),
  });
  const pickDoc = (file: File | null) => {
    setDocErr(undefined);
    if (!file) return setDoc(null);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return setDocErr("Documents must be PDF, JPG or PNG");
    if (file.size > 10 * 1024 * 1024) return setDocErr("Documents can be up to 10 MB");
    setDoc(file);
  };
  const text = (k: keyof typeof f, label: string, opts: { required?: boolean; placeholder?: string; type?: string; max?: number } = {}) => (
    <div>
      <label className={labelCls} htmlFor={`o-${k}`}>{label}{!opts.required && <span className="font-normal text-stone-500"> (optional)</span>}</label>
      <input id={`o-${k}`} type={opts.type ?? "text"} required={opts.required} maxLength={opts.max ?? 200} className={inputCls} value={f[k]} onChange={set(k)} placeholder={opts.placeholder} />
    </div>
  );
  return (
    <Page title="Register an organization">
      <p className="mb-4 rounded-xl bg-brand-light p-3 text-sm text-brand-dark">We check every organization before it shows up. You'll be its admin and can invite your team.</p>
      <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); if (!docErr) m.mutate(); }}>
        {text("name", "Name", { required: true, max: 100 })}
        <div>
          <label className={labelCls} htmlFor="o-type">Type</label>
          <select id="o-type" required className={inputCls} value={f.type} onChange={set("type")}>
            <option value="">Pick one</option>
            {(Object.keys(ORG_TYPE) as OrgType[]).map((t) => <option key={t} value={t}>{ORG_TYPE[t]}</option>)}
          </select>
        </div>
        {text("email", "Email", { required: true, type: "email" })}
        {text("website", "Website", { placeholder: "https://…", type: "url" })}
        {text("address", "Address", { required: true, max: 160 })}
        {text("city", "City", { required: true, max: 80 })}
        <div>
          <span className={labelCls}>Pin on the map</span>
          <LocationPicker value={pin} onChange={setPin} />
        </div>
        <div>
          <label className={labelCls} htmlFor="o-description">What do you do?</label>
          <textarea id="o-description" required minLength={10} maxLength={1000} rows={3} className={inputCls} value={f.description} onChange={set("description")} />
        </div>
        {text("mission", "Mission", { max: 500 })}
        {text("serviceArea", "Service area", { placeholder: "e.g. Erlangen and Herzogenaurach" })}
        {text("contactName", "Contact person", { required: true, max: 80 })}
        {text("registrationNumber", "Registration number", { max: 60 })}
        <div>
          <label className={labelCls} htmlFor="o-doc">Verification document <span className="font-normal text-stone-500">(PDF, JPG or PNG, up to 10 MB)</span></label>
          <input id="o-doc" type="file" accept="application/pdf,image/jpeg,image/png" className="block w-full text-sm" onChange={(e) => pickDoc(e.target.files?.[0] ?? null)} />
          {docErr && <p className="mt-1 text-sm text-red-700">{docErr}</p>}
          <p className="mt-1 text-xs text-stone-500">Only our admins and your organization's admins can open it.</p>
        </div>
        <ErrorNote error={m.error} />
        <button className={primaryBtn} disabled={m.isPending}>{m.isPending ? "Sending…" : "Register organization"}</button>
      </form>
    </Page>
  );
}

/** /organizations/:id/dashboard: team, items collected, bulk claims, documents. Members only. */
export function OrgDashboardPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["org-dashboard", id], queryFn: () => fetchOrgDashboard(id) });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("volunteer");
  const refresh = () => qc.invalidateQueries({ queryKey: ["org-dashboard", id] });
  const invite = useMutation({ mutationFn: () => inviteMember(id, email, role), onSuccess: () => { setEmail(""); refresh(); } });
  const change = useMutation({ mutationFn: (v: { userId: string; role: OrgRole }) => changeMemberRole(id, v.userId, v.role), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (userId: string) => removeMember(id, userId), onSuccess: refresh });
  if (q.isLoading) return <Page title="Team dashboard"><Skeleton rows={3} /></Page>;
  if (!q.data) return <Page title="Team dashboard"><NotFoundNote error={q.error} what="dashboard" /></Page>;
  const d = q.data;
  const isAdmin = d.organization.myRole === "admin";
  const canBulk = d.organization.myRole === "admin" || d.organization.myRole === "manager";
  const approved = d.organization.status === "approved";
  return (
    <Page title={d.organization.name} wide>
      {!approved && <p className="mb-4 rounded-xl bg-accent-light p-3 text-sm text-accent-dark">Thanks for registering. We're reviewing your organization; pickup runs open once it's approved.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 text-center ring-1 ring-stone-200">
              <p className="text-3xl font-extrabold text-brand-dark">{d.itemsCollected}</p>
              <p className="text-xs text-stone-600">Items collected</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-center ring-1 ring-stone-200">
              <p className="text-3xl font-extrabold text-brand-dark">{d.members.length}</p>
              <p className="text-xs text-stone-600">Team members</p>
            </div>
          </div>
          <OrgImpactPanel orgId={id} member />
          <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-bold">Pickup runs</h2>
              {canBulk && approved && (
                <Link to={`/organizations/${id}/bulk-claims/new`} className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white">New pickup run</Link>
              )}
            </div>
            {d.bulkClaims.length === 0 ? (
              <p className="text-sm text-stone-500">No pickup runs yet.{canBulk && approved && " Pick several listings and collect them in one go."}</p>
            ) : (
              <ul className="space-y-2">
                {d.bulkClaims.map((b) => (
                  <li key={b.id}>
                    <Link to={`/bulk-claims/${b.id}`} className="flex items-center justify-between gap-2 rounded-xl p-2 ring-1 ring-stone-200 hover:ring-brand">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{b.name}</span>
                        <span className="text-xs text-stone-500">{formatDay(b.scheduledPickupDate)} · {b.collected}/{b.items} collected</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${BULK_STATUS[b.status].tone}`}>{BULK_STATUS[b.status].label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {isAdmin && d.documents.length > 0 && (
            <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
              <h2 className="mb-2 font-bold">Verification documents</h2>
              <ul className="space-y-1 text-sm">
                {d.documents.map((doc) => (
                  <li key={doc.id}><a className="font-semibold text-brand-dark underline" href={`/api/organizations/${id}/documents/${doc.id}`} target="_blank" rel="noreferrer">{doc.filename}</a> <span className="text-stone-500">({Math.round(doc.size / 1024)} KB)</span></li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <h2 className="font-bold">Team</h2>
          <ul className="divide-y divide-stone-100">
            {d.members.map((mem) => (
              <li key={mem.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <Link to={`/users/${mem.userId}`} className="font-semibold hover:underline">{mem.name}</Link>
                  {mem.email && <span className="block truncate text-xs text-stone-500">{mem.email}</span>}
                </span>
                {isAdmin ? (
                  <span className="flex items-center gap-2">
                    <select aria-label={`Role of ${mem.name}`} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" value={mem.role} onChange={(e) => change.mutate({ userId: mem.userId, role: e.target.value as OrgRole })}>
                      {(Object.keys(ORG_ROLE) as OrgRole[]).map((r) => <option key={r} value={r}>{ORG_ROLE[r].label}</option>)}
                    </select>
                    <button className="text-sm font-semibold text-stone-500 underline hover:text-red-700" onClick={() => remove.mutate(mem.userId)}>Remove</button>
                  </span>
                ) : (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold">{ORG_ROLE[mem.role].label}</span>
                )}
              </li>
            ))}
          </ul>
          <ErrorNote error={change.error ?? remove.error} />
          {isAdmin && (
            <form className="space-y-2 border-t border-stone-100 pt-3" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
              <h3 className="text-sm font-bold text-stone-700">Invite someone with a FreshShare account</h3>
              <label className="sr-only" htmlFor="inv-email">Email</label>
              <input id="inv-email" type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email" />
              <label className="sr-only" htmlFor="inv-role">Role</label>
              <select id="inv-role" className={inputCls} value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
                {(Object.keys(ORG_ROLE) as OrgRole[]).map((r) => <option key={r} value={r}>{ORG_ROLE[r].label}: {ORG_ROLE[r].help}</option>)}
              </select>
              <ErrorNote error={invite.error} />
              {invite.isSuccess && <Success>{invite.data.message}</Success>}
              <button className={primaryBtn} disabled={invite.isPending}>Invite</button>
            </form>
          )}
        </section>
      </div>
    </Page>
  );
}

/** /organizations/:id/bulk-claims/new: pick several listings into one named pickup run. Admins/managers of approved orgs. */
export function NewBulkClaimPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [radius, setRadius] = useState(5000);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const tomorrow = new Date(Date.now() + 86400_000);
  const [date, setDate] = useState(isoDay(tomorrow));
  const q = useQuery({ queryKey: ["candidates", id, radius], queryFn: () => fetchCandidates(id, radius), retry: false });
  const m = useMutation({
    mutationFn: () => createBulkClaim(id, { name, notes: notes || undefined, scheduledPickupDate: new Date(`${date}T12:00:00`).toISOString(), listingIds: picked }),
    onSuccess: (r) => nav(`/bulk-claims/${r.bulkClaim.id}${r.skipped.length ? `?skipped=${r.skipped.length}` : ""}`),
  });
  if (q.error instanceof ApiError && q.error.status === 404) return <Navigate to="/404" replace />;
  return (
    <Page title="New pickup run" wide>
      <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="b-name">Name</label>
            <input id="b-name" required minLength={3} maxLength={80} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Saturday morning run" />
          </div>
          <div>
            <label className={labelCls} htmlFor="b-date">Pickup date</label>
            <input id="b-date" type="date" required min={isoDay(new Date())} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="b-notes">Notes <span className="font-normal text-stone-500">(optional)</span></label>
            <textarea id="b-notes" rows={2} maxLength={500} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Van available from 10:00" />
          </div>
          <p className="rounded-xl bg-brand-light p-3 text-sm text-brand-dark">
            Each giver gets a normal request and confirms or declines it. Volunteers tick items as collected on the day.
          </p>
          <ErrorNote error={m.error} />
          <button className={primaryBtn} disabled={m.isPending || picked.length === 0 || !name}>
            {m.isPending ? "Creating…" : `Request ${picked.length} ${picked.length === 1 ? "listing" : "listings"}`}
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Available nearby</h2>
            <select aria-label="Distance" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {[2000, 5000, 10000].map((r) => <option key={r} value={r}>Within {r / 1000} km</option>)}
            </select>
          </div>
          {q.isLoading && <Skeleton rows={4} className="h-16" />}
          <ErrorNote error={q.error} />
          {q.data?.length === 0 && <Empty title="Nothing available nearby right now">Try a larger distance.</Empty>}
          <ul className="space-y-2">
            {q.data?.map((l) => {
              const on = picked.includes(l.id);
              return (
                <li key={l.id}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-2 ring-1 ${on ? "ring-2 ring-brand" : "ring-stone-200"}`}>
                    <input type="checkbox" className="h-5 w-5" checked={on} onChange={() => setPicked((xs) => (on ? xs.filter((x) => x !== l.id) : [...xs, l.id]))} aria-label={l.title} />
                    <img src={l.photoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{l.title}</span>
                      <span className="text-xs text-stone-600">{formatDistance(l.distanceM)} · {l.portions} {l.portions === 1 ? "portion" : "portions"} · {l.giver.name} · until {formatTime(l.pickupUntil)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </form>
    </Page>
  );
}

const ITEM_STATUS: Record<string, string> = {
  pending: "Waiting for the giver",
  confirmed: "Confirmed · ready to collect",
  collected: "Collected",
  cancelled: "Cancelled",
  declined: "Declined by the giver",
  lapsed: "Request expired",
};

/** /bulk-claims/:id: the run. Volunteers tick confirmed items as collected. */
export function BulkClaimPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bulk", id], queryFn: () => fetchBulkClaim(id), refetchInterval: 15_000 });
  const collect = useMutation({ mutationFn: (itemId: string) => collectBulkItem(id, itemId), onSuccess: (b) => qc.setQueryData(["bulk", id], b) });
  const cancel = useMutation({ mutationFn: () => cancelBulkClaim(id), onSuccess: (b) => qc.setQueryData(["bulk", id], b) });
  if (q.isLoading) return <Page title="Pickup run"><Skeleton rows={3} /></Page>;
  if (!q.data) return <Page title="Pickup run"><NotFoundNote error={q.error} what="pickup run" /></Page>;
  const b = q.data;
  const canCollect = b.myRole !== "viewer";
  const canCancel = b.myRole === "admin" || b.myRole === "manager";
  const st = BULK_STATUS[b.status];
  return (
    <Page title={b.name} wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${st.tone}`} role="status">{st.label}</span>
        <span className="text-sm text-stone-600">{formatDay(b.scheduledPickupDate)} · <Link className="underline" to={`/organizations/${b.organization.id}/dashboard`}>{b.organization.name}</Link></span>
      </div>
      {b.notes && <p className="mb-4 rounded-2xl bg-white p-4 text-stone-700 ring-1 ring-stone-200">{b.notes}</p>}
      <ErrorNote error={collect.error ?? cancel.error} />
      <ul className="space-y-2">
        {b.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
            <img src={i.listing.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{i.listing.title}</p>
              <p className="text-xs text-stone-600">{i.listing.giver.name} · {formatDistance(i.listing.distanceM)} · {ITEM_STATUS[i.claimStatus]}</p>
              {i.listing.lat !== undefined && (
                <a className="text-xs font-semibold text-brand-dark underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${i.listing.lat}&mlon=${i.listing.lng}#map=18/${i.listing.lat}/${i.listing.lng}`}>
                  {i.listing.handoverSpot ? `Meet at: ${i.listing.handoverSpot}` : "Open pickup spot in maps"}
                </a>
              )}
            </div>
            {canCollect && (
              <label className={`flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-semibold ring-1 ${i.isCollected ? "bg-brand text-white ring-brand" : "ring-stone-300"} ${i.claimStatus !== "confirmed" && !i.isCollected ? "opacity-50" : "cursor-pointer"}`}>
                <input type="checkbox" checked={i.isCollected} disabled={i.isCollected || i.claimStatus !== "confirmed" || collect.isPending} onChange={() => collect.mutate(i.id)} />
                {i.isCollected ? "Collected" : "Mark collected"}
              </label>
            )}
          </li>
        ))}
      </ul>
      {canCancel && (b.status === "pending" || b.status === "in_progress") && (
        <button className="mt-6 min-h-[44px] rounded-full px-5 text-sm font-semibold text-stone-600 ring-1 ring-stone-300" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
          Cancel the remaining items
        </button>
      )}
    </Page>
  );
}
