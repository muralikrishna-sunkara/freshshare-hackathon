import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchFridges, fetchListing, fetchNearby, type Category, type Listing } from "../api/client";
import { BottomSheet } from "../components/BottomSheet";
import { ListingActions } from "../components/ListingActions";
import { ListingCard } from "../components/ListingCard";
import { ListingMap } from "../components/ListingMap";
import { useLocation } from "../hooks/useLocation";
import { useMe } from "../hooks/useMe";
import { CATEGORY, formatDistance } from "../lib/format";

const RADII = [500, 1000, 2000] as const;
const chipBase = "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition min-h-[40px]";
const chipOn = "bg-brand-dark text-white";
const chipOff = "bg-white text-stone-700 ring-1 ring-stone-300";

export function MapHome() {
  const loc = useLocation();
  const [radius, setRadius] = useState<number>(2000);
  const [category, setCategory] = useState<Category | undefined>();
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [params, setParams] = useSearchParams();
  const focusId = params.get("listing");
  const nav = useNavigate();
  const me = useMe();

  // Deep link / just posted: open that listing and centre the map on it.
  const focusQ = useQuery({ queryKey: ["listing", focusId], queryFn: () => fetchListing(focusId!), enabled: !!focusId });
  useEffect(() => {
    if (focusQ.data) setSelected(focusQ.data);
  }, [focusQ.data]);
  const closeSheet = () => {
    setSelected(null);
    if (focusId) setParams({}, { replace: true });
  };

  const listingsQ = useQuery({
    queryKey: ["listings", loc.lat, loc.lng, radius, category],
    queryFn: () => fetchNearby(loc.lat, loc.lng, radius, category),
  });
  const fridgesQ = useQuery({
    queryKey: ["fridges", loc.lat, loc.lng],
    queryFn: () => fetchFridges(loc.lat, loc.lng, 2000),
  });
  const listings = listingsQ.data ?? [];
  const fridges = fridgesQ.data ?? [];
  const radiusLabel = formatDistance(radius);

  return (
    <div className="relative flex h-full w-full flex-col bg-stone-50">
      {/* Header: brand, impact banner, filters */}
      <header className="z-[1000] space-y-2 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-tight text-brand-dark">
            Fresh<span className="text-accent">Share</span>
          </h1>
          <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-stone-100 p-1 text-sm font-semibold" role="tablist">
            {(["map", "list"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`min-h-[36px] rounded-full px-3 capitalize ${view === v ? "bg-white shadow text-stone-900" : "text-stone-500"}`}
              >
                {v}
              </button>
            ))}
          </div>
          {me.data && (
            <Link to="/pickups" className="flex h-10 items-center rounded-full px-2 text-sm font-semibold text-brand-dark" aria-label="My pickups">
              Pickups
            </Link>
          )}
          {me.data ? (
            <Link
              to="/profile"
              aria-label={`Profile of ${me.data.name}`}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
            >
              {me.data.name.charAt(0)}
            </Link>
          ) : (
            <Link to="/signin" className="min-h-[40px] rounded-full px-2 py-2 text-sm font-semibold text-brand-dark">
              Sign in
            </Link>
          )}
          </div>
        </div>
        {/* TODO(Block 10): real impact numbers from GET /api/impact */}
        <p className="rounded-xl bg-brand-light px-3 py-2 text-sm text-brand-dark">
          🌱 This week your neighbourhood saved <strong>18 portions</strong> (~7 kg, estimate)
        </p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
          {RADII.map((r) => (
            <button key={r} onClick={() => setRadius(r)} className={`${chipBase} ${radius === r ? chipOn : chipOff}`} aria-pressed={radius === r}>
              {formatDistance(r)}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-stone-200" />
          <button onClick={() => setCategory(undefined)} className={`${chipBase} ${!category ? chipOn : chipOff}`} aria-pressed={!category}>
            All
          </button>
          {(Object.keys(CATEGORY) as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? undefined : c)}
              className={`${chipBase} ${category === c ? chipOn : chipOff}`}
              aria-pressed={category === c}
            >
              {CATEGORY[c].emoji} {CATEGORY[c].label}
            </button>
          ))}
        </div>
        {loc.source === "demo" && <p className="text-xs text-stone-500">Showing the Erlangen demo area.</p>}
      </header>

      <main className="relative min-h-0 flex-1">
        {listingsQ.isError && (
          <div className="absolute inset-x-4 top-4 z-[1100] rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow">
            Could not load food nearby.{" "}
            <button className="font-semibold underline" onClick={() => listingsQ.refetch()}>
              Try again
            </button>
          </div>
        )}

        {view === "map" ? (
          <>
            <ListingMap
              centre={loc}
              radius={radius}
              listings={listings}
              fridges={fridges}
              onSelect={setSelected}
              focus={focusQ.data ? { lat: focusQ.data.publicLat, lng: focusQ.data.publicLng } : undefined}
            />
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
              <span className="rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-stone-700 shadow">
                {listingsQ.isLoading ? "Finding food nearby…" : `${listings.length} ${listings.length === 1 ? "listing" : "listings"} within ${radiusLabel}`}
              </span>
            </div>
          </>
        ) : (
          <div className="h-full space-y-3 overflow-y-auto p-4 pb-28">
            {listingsQ.isLoading &&
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-200" />)}
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} compact onClick={() => setSelected(l)} />
            ))}
          </div>
        )}

        {!listingsQ.isLoading && !listingsQ.isError && listings.length === 0 && (
          <div className="absolute inset-x-4 top-14 z-[1000] rounded-2xl bg-white p-4 text-center shadow-lg">
            <p className="font-semibold">Nothing within {radiusLabel} yet.</p>
            <p className="text-sm text-stone-600">
              There {fridges.length === 1 ? "is 1 community fridge" : `are ${fridges.length} community fridges`} nearby.
            </p>
          </div>
        )}

        <button
          className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-[1000] min-h-[52px] -translate-x-1/2 rounded-full bg-accent px-6 text-base font-bold text-white shadow-lg"
          onClick={() => nav("/share")}
        >
          + Share food
        </button>
      </main>

      <BottomSheet open={!!selected} onClose={closeSheet}>
        {selected && (
          <>
            <ListingCard listing={selected} />
            <ListingActions listing={selected} />
          </>
        )}
      </BottomSheet>
    </div>
  );
}
