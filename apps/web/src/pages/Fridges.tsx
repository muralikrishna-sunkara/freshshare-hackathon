import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import { ApiError, fetchFridge, fetchFridges, fridgeCheckIn, suggestFridge, type FillLevel, type Fridge, type FridgeKind } from "../api/client";
import { ListingCard } from "../components/ListingCard";
import { ListingMap } from "../components/ListingMap";
import { LocationPicker } from "../components/LocationPicker";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { Empty, Skeleton, Success } from "../components/States";
import { DEMO_CENTRE, useLocation } from "../hooks/useLocation";
import { useMe } from "../hooks/useMe";
import { FILL, formatDistance, FRIDGE_KIND, timeAgo } from "../lib/format";

const RADIUS = 10000;

const fridgeIcon = L.divIcon({
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  html: `<div style="width:32px;height:32px;border-radius:9px;background:#fff;border:2.5px solid #1f4337;display:flex;align-items:center;justify-content:center;font-size:17px">🧊</div>`,
});

function FillBadge({ f }: { f: Fridge }) {
  const c = f.lastCheckIn;
  if (!c) return <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">No check-ins yet</span>;
  const level: FillLevel = c.fillLevel ?? (c.state === "empty" ? "empty" : "half");
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${FILL[level].tone}`}>
      {FILL[level].label} · {timeAgo(c.at)}
    </span>
  );
}

/** /fridges: list + map of approved fridges, pantries and drop-off points. */
export function FridgesPage() {
  const loc = useLocation();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["fridges", loc.lat, loc.lng, RADIUS], queryFn: () => fetchFridges(loc.lat, loc.lng, RADIUS) });
  const fridges = q.data ?? [];
  return (
    <Page title="Community fridges" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-stone-600">Fridges, pantry shelves and drop-off points within 10 km. Take what you need, leave what you can.</p>
        <Link to="/fridges/new" className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white">Suggest a fridge</Link>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          {q.isLoading && <Skeleton rows={3} />}
          <ErrorNote error={q.error} />
          {!q.isLoading && !q.isError && fridges.length === 0 && (
            <Empty title="No fridges nearby yet" action={{ to: "/fridges/new", label: "Suggest one" }}>
              Know a fridge or a pantry shelf? Tell us and we'll add it to the map.
            </Empty>
          )}
          {fridges.map((f) => (
            <Link key={f.id} to={`/fridges/${f.id}`} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200 hover:ring-brand">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-light text-3xl">
                {f.photoUrl ? <img src={f.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : FRIDGE_KIND[f.kind ?? "fridge"].emoji}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold text-stone-500">{FRIDGE_KIND[f.kind ?? "fridge"].label} · {formatDistance(f.distanceM)} away</p>
                <p className="truncate font-bold">{f.name}</p>
                <p className="truncate text-sm text-stone-600">{f.address}</p>
                <p className="text-sm text-stone-600">Open: {f.openingHours}</p>
                <FillBadge f={f} />
              </div>
            </Link>
          ))}
        </div>
        <div className="h-[360px] overflow-hidden rounded-2xl ring-1 ring-stone-200 lg:sticky lg:top-6 lg:h-[560px]">
          <ListingMap centre={loc} radius={RADIUS} listings={[]} fridges={fridges} onSelect={() => {}} onSelectFridge={(f) => nav(`/fridges/${f.id}`)} />
        </div>
      </div>
    </Page>
  );
}

/** /fridges/:id: info, map, check-in history, listings dropped there, and the check-in form. */
export function FridgePage() {
  const { id = "" } = useParams();
  const me = useMe();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["fridge", id], queryFn: () => fetchFridge(id) });
  const [fill, setFill] = useState<FillLevel | "">("");
  const [contents, setContents] = useState("");
  const m = useMutation({
    mutationFn: () => fridgeCheckIn(id, fill as FillLevel, contents.trim() || undefined),
    onSuccess: () => {
      setFill("");
      setContents("");
      qc.invalidateQueries({ queryKey: ["fridge", id] });
      qc.invalidateQueries({ queryKey: ["fridges"] });
    },
  });
  if (q.isLoading) return <Page title="Community fridge"><Skeleton rows={3} className="h-32" /></Page>;
  if (q.isError || !q.data)
    return (
      <Page title="Community fridge">
        <Empty title={q.error instanceof ApiError && q.error.status === 404 ? "This fridge isn't on the map." : "Couldn't load this fridge."} action={{ to: "/fridges", label: "See all fridges" }} />
      </Page>
    );
  const f = q.data;
  const kind = FRIDGE_KIND[f.kind];
  return (
    <Page title={f.name} wide>
      {f.status !== "active" && (
        <p className="mb-4 rounded-xl bg-accent-light p-3 text-sm text-accent-dark">
          {f.status === "pending" ? "Waiting for approval. Only you and our admins can see this page for now." : `Status: ${f.status}`}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {f.photoUrl && <img src={f.photoUrl} alt={f.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />}
          <section className="space-y-1 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <p className="text-sm font-semibold text-brand-dark">{kind.emoji} {kind.label}</p>
            <p>{f.address}</p>
            <p className="text-sm text-stone-600">Open: {f.openingHours}</p>
            {f.description && <p className="pt-2 text-stone-700">{f.description}</p>}
            {f.accessNotes && <p className="text-sm text-stone-600"><strong>Access:</strong> {f.accessNotes}</p>}
            <a className="inline-block pt-2 text-sm font-semibold text-brand-dark underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/directions?to=${f.lat}%2C${f.lng}`}>
              Directions
            </a>
          </section>
          <div className="h-56 overflow-hidden rounded-2xl ring-1 ring-stone-200">
            <MapContainer center={[f.lat, f.lng]} zoom={16} className="h-full w-full" zoomControl={false}>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[f.lat, f.lng]} icon={fridgeIcon} />
            </MapContainer>
          </div>
        </div>
        <div className="space-y-4">
          {f.status === "active" && (
            <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
              <h2 className="font-bold">Check in</h2>
              {me.data ? (
                <form
                  className="space-y-3"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (fill) m.mutate();
                  }}
                >
                  <fieldset>
                    <legend className={labelCls}>How full is it?</legend>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(FILL) as FillLevel[]).map((l) => (
                        <label key={l} className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl text-sm font-semibold ring-1 ${fill === l ? "bg-brand-dark text-white ring-brand-dark" : "bg-white ring-stone-300"}`}>
                          <input type="radio" name="fill" value={l} checked={fill === l} onChange={() => setFill(l)} className="sr-only" />
                          {FILL[l].label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <label className={labelCls} htmlFor="contents">What's inside? <span className="font-normal text-stone-500">(optional)</span></label>
                    <input id="contents" maxLength={300} className={inputCls} value={contents} onChange={(e) => setContents(e.target.value)} placeholder="e.g. Bread, yoghurt, apples" />
                  </div>
                  <ErrorNote error={m.error} />
                  {m.isSuccess && <Success>{m.data.message}</Success>}
                  <button className={primaryBtn} disabled={!fill || m.isPending}>{m.isPending ? "Saving…" : "Save check-in"}</button>
                </form>
              ) : (
                <Link to={`/signin?next=/fridges/${f.id}`} className="font-semibold text-brand-dark underline">Sign in to check in</Link>
              )}
            </section>
          )}
          <section>
            <h2 className="mb-2 text-sm font-bold text-stone-700">Dropped here now</h2>
            {f.listings.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">No listings dropped here right now.</p>
            ) : (
              <div className="space-y-2">
                {f.listings.map((l) => (
                  <Link key={l.id} to={`/listings/${l.id}`} className="block">
                    <ListingCard listing={l} compact />
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-bold text-stone-700">Check-in history</h2>
            {f.checkIns.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">No check-ins yet. Be the first.</p>
            ) : (
              <ul className="space-y-2">
                {f.checkIns.map((c) => {
                  const level: FillLevel = c.fillLevel ?? (c.state === "empty" ? "empty" : "half");
                  return (
                    <li key={c.id} className="rounded-2xl bg-white p-3 text-sm ring-1 ring-stone-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${FILL[level].tone}`}>{FILL[level].label}</span>
                        <span className="text-stone-500">{c.by.name} · {timeAgo(c.at)}</span>
                      </div>
                      {c.contents && <p className="mt-1 text-stone-700">{c.contents}</p>}
                      {c.state === "needs_cleaning" && <p className="mt-1 text-accent-dark">Needs cleaning</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Page>
  );
}

/** /fridges/new: suggest a fridge. Saved as pending until an admin approves it. */
export function SuggestFridgePage() {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FridgeKind>("fridge");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState(DEMO_CENTRE);
  const [hours, setHours] = useState("");
  const [access, setAccess] = useState("");
  const m = useMutation({
    mutationFn: () =>
      suggestFridge({ name, kind, description: description || undefined, address, lat: pin.lat, lng: pin.lng, openingHours: hours, accessNotes: access || undefined }),
  });
  if (m.isSuccess)
    return (
      <Page title="Suggest a fridge">
        <div className="space-y-3 rounded-2xl bg-white p-6 text-center ring-1 ring-stone-200">
          <p className="text-3xl" aria-hidden>🧊</p>
          <p className="text-lg font-bold">{m.data.message}</p>
          <p className="text-stone-600">It's pending for now. You can already see it on its page.</p>
          <Link to={`/fridges/${m.data.fridge.id}`} className="inline-block font-semibold text-brand-dark underline">Open the fridge page</Link>
        </div>
      </Page>
    );
  return (
    <Page title="Suggest a fridge">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div>
          <label className={labelCls} htmlFor="f-name">Name</label>
          <input id="f-name" required minLength={3} maxLength={80} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fridge at the parish hall" />
        </div>
        <fieldset>
          <legend className={labelCls}>Kind</legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(FRIDGE_KIND) as FridgeKind[]).map((k) => (
              <label key={k} className={`flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl px-2 text-center text-sm font-semibold ring-1 ${kind === k ? "bg-brand-dark text-white ring-brand-dark" : "bg-white ring-stone-300"}`}>
                <input type="radio" name="kind" className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
                {FRIDGE_KIND[k].emoji} {FRIDGE_KIND[k].label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className={labelCls} htmlFor="f-desc">Description <span className="font-normal text-stone-500">(optional)</span></label>
          <textarea id="f-desc" rows={2} maxLength={500} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-address">Address</label>
          <input id="f-address" required minLength={5} maxLength={160} className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street and number, town" />
        </div>
        <div>
          <span className={labelCls}>Pin on the map</span>
          <LocationPicker value={pin} onChange={setPin} />
          <p className="mt-1 text-xs text-stone-500">Tap the map where the fridge is.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="f-hours">Opening hours</label>
          <input id="f-hours" required minLength={2} maxLength={120} className={inputCls} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. Daily 08:00-20:00" />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-access">Access notes <span className="font-normal text-stone-500">(optional)</span></label>
          <input id="f-access" maxLength={300} className={inputCls} value={access} onChange={(e) => setAccess(e.target.value)} placeholder="e.g. Side door, ring the bell" />
        </div>
        <ErrorNote error={m.error} />
        <button className={primaryBtn} disabled={m.isPending}>{m.isPending ? "Sending…" : "Suggest this fridge"}</button>
      </form>
    </Page>
  );
}
