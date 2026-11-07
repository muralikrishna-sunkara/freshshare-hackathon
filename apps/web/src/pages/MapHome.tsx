import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchFridges, fetchImpact, fetchListing, fetchNearby, type Category, type DietaryTag, type Fridge, type Listing } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { BottomSheet } from "../components/BottomSheet";
import { FridgeSheet } from "../components/FridgeSheet";
import { ListingActions } from "../components/ListingActions";
import { ListingCard } from "../components/ListingCard";
import { ListingMap } from "../components/ListingMap";
import { SidePanel } from "../components/SidePanel";
import { useLocation } from "../hooks/useLocation";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useMe } from "../hooks/useMe";
import { CATEGORY, DIETARY, formatDistance } from "../lib/format";

const RADII = [1000, 2000, 5000, 10000] as const;
const chipBase = "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition min-h-[40px]";
const chipOn = "bg-brand-dark text-white";
const chipOff = "bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50";

export function MapHome() {
  const loc = useLocation();
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [selectedFridge, setSelectedFridge] = useState<Fridge | null>(null);
  const [params, setParams] = useSearchParams();
  // Filters live in the URL so a filtered view can be shared or bookmarked.
  const radiusParam = Number(params.get("km")) * 1000;
  const radius: number = (RADII as readonly number[]).includes(radiusParam) ? radiusParam : 2000;
  const category = (params.get("category") as Category | null) ?? undefined;
  const diet = (params.get("diet") as DietaryTag | null) ?? undefined;
  const showFridges = params.get("fridges") !== "0";
  const setFilter = (key: string, value: string | undefined) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (value === undefined) n.delete(key);
        else n.set(key, value);
        return n;
      },
      { replace: true },
    );
  const setRadius = (r: number) => setFilter("km", r === 2000 ? undefined : String(r / 1000));
  const setCategory = (c: Category | undefined) => setFilter("category", c);
  const setDiet = (d: DietaryTag | undefined) => setFilter("diet", d);
  const setShowFridges = (f: (v: boolean) => boolean) => setFilter("fridges", f(showFridges) ? undefined : "0");
  const focusId = params.get("listing");
  const me = useMe();

  // Deep link / just posted: open that listing and centre the map on it.
  const focusQ = useQuery({ queryKey: ["listing", focusId], queryFn: () => fetchListing(focusId!), enabled: !!focusId });
  useEffect(() => {
    if (focusQ.data) setSelected(focusQ.data);
  }, [focusQ.data]);
  const closeListing = () => {
    setSelected(null);
    if (focusId) setFilter("listing", undefined);
  };
  const openListing = (l: Listing) => {
    setSelectedFridge(null);
    setSelected(l);
  };
  const openFridge = (f: Fridge) => {
    setSelected(null);
    setSelectedFridge(f);
  };

  const listingsQ = useQuery({
    queryKey: ["listings", loc.lat, loc.lng, radius, category, diet],
    queryFn: () => fetchNearby(loc.lat, loc.lng, radius, category, diet),
  });
  const fridgesQ = useQuery({
    queryKey: ["fridges", loc.lat, loc.lng, radius],
    queryFn: () => fetchFridges(loc.lat, loc.lng, Math.max(radius, 2000)),
  });
  const impactQ = useQuery({
    queryKey: ["impact", loc.lat, loc.lng, me.data?.id],
    queryFn: () => fetchImpact(loc.lat, loc.lng, 2000),
    refetchInterval: 30_000,
  });
  const listings = listingsQ.data ?? [];
  const fridges = fridgesQ.data ?? [];
  const radiusLabel = formatDistance(radius);
  const countLabel = listingsQ.isLoading
    ? "Finding food nearby…"
    : `${listings.length} ${listings.length === 1 ? "listing" : "listings"} within ${radiusLabel}`;

  const impactBanner = (
    <p className="rounded-xl bg-brand-light px-3 py-2 text-sm text-brand-dark" aria-live="polite">
      {impactQ.data ? (
        <>
          🌱 This week your neighbourhood saved <strong>{impactQ.data.week.portions} portions</strong> (~{impactQ.data.week.kg} kg, estimate)
        </>
      ) : (
        "🌱 Counting this week's saved food…"
      )}
    </p>
  );

  const filters = (
    <div className={isDesktop ? "flex flex-wrap gap-2" : "-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5"}>
      {RADII.map((r) => (
        <button key={r} onClick={() => setRadius(r)} className={`${chipBase} ${radius === r ? chipOn : chipOff}`} aria-pressed={radius === r}>
          {formatDistance(r)}
        </button>
      ))}
      <button onClick={() => setShowFridges((v) => !v)} className={`${chipBase} ${showFridges ? chipOn : chipOff}`} aria-pressed={showFridges}>
        🧊 Fridges
      </button>
      {!isDesktop && <span className="mx-1 w-px shrink-0 bg-stone-200" />}
      {isDesktop && <span className="basis-full" />}
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
      {!isDesktop && <span className="mx-1 w-px shrink-0 bg-stone-200" />}
      <select
        aria-label="Dietary"
        value={diet ?? ""}
        onChange={(e) => setDiet((e.target.value || undefined) as DietaryTag | undefined)}
        className={`${chipBase} ${diet ? chipOn : chipOff} pr-8`}
      >
        <option value="">Any diet</option>
        {(Object.keys(DIETARY) as DietaryTag[]).map((d) => (
          <option key={d} value={d}>{DIETARY[d]}</option>
        ))}
      </select>
    </div>
  );

  const list = (
    <div className="space-y-3">
      {listingsQ.isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-200" />)}
      {listings.map((l) => (
        <div key={l.id} className={selected?.id === l.id ? "rounded-2xl ring-2 ring-brand" : ""}>
          <ListingCard listing={l} compact onClick={() => openListing(l)} />
        </div>
      ))}
    </div>
  );

  const emptyState = !listingsQ.isLoading && !listingsQ.isError && listings.length === 0 && (
    <div className="rounded-2xl bg-white p-4 text-center shadow-lg ring-1 ring-stone-200">
      <p className="font-semibold">Nothing within {radiusLabel} yet.</p>
      <p className="text-sm text-stone-600">
        There {fridges.length === 1 ? "is 1 community fridge" : `are ${fridges.length} community fridges`} nearby.
      </p>
    </div>
  );

  const errorNote = listingsQ.isError && (
    <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow">
      Could not load food nearby.{" "}
      <button className="font-semibold underline" onClick={() => listingsQ.refetch()}>
        Try again
      </button>
    </div>
  );

  const map = (
    <ListingMap
      centre={loc}
      radius={radius}
      listings={listings}
      fridges={showFridges ? fridges : []}
      onSelect={openListing}
      onSelectFridge={openFridge}
      focus={focusQ.data ? { lat: focusQ.data.publicLat, lng: focusQ.data.publicLng } : undefined}
    />
  );

  const listingDetail = selected && (
    <>
      <ListingCard listing={selected} />
      <ListingActions listing={selected} />
    </>
  );
  const fridgeDetail = selectedFridge && <FridgeSheet fridge={fridges.find((f) => f.id === selectedFridge.id) ?? selectedFridge} />;

  return (
    <div className="flex h-full w-full flex-col bg-stone-50">
      <AppHeader />
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[420px] shrink-0 flex-col border-r border-stone-200 bg-white">
            <div className="space-y-3 border-b border-stone-200 p-5">
              <h1 className="text-2xl font-bold">Free food near you</h1>
              {impactBanner}
              {filters}
              {loc.source === "demo" && <p className="text-xs text-stone-500">Showing the Erlangen demo area.</p>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <p className="mb-3 text-sm font-semibold text-stone-600">{countLabel}</p>
              {errorNote}
              {emptyState}
              {list}
            </div>
          </aside>
          <main className="relative min-w-0 flex-1">
            {map}
            <Panel open={!!selected} onClose={closeListing} label="Listing details">{listingDetail}</Panel>
            <Panel open={!!selectedFridge} onClose={() => setSelectedFridge(null)} label="Community fridge">{fridgeDetail}</Panel>
          </main>
        </div>
      ) : (
        <>
          <div className="z-[1000] space-y-2 bg-white px-4 pb-3 pt-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-stone-700">{countLabel}</p>
              <div className="flex rounded-full bg-stone-100 p-1 text-sm font-semibold" role="tablist">
                {(["map", "list"] as const).map((v) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={`min-h-[36px] rounded-full px-3 capitalize ${view === v ? "bg-white text-stone-900 shadow" : "text-stone-500"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {impactBanner}
            {filters}
            {loc.source === "demo" && <p className="text-xs text-stone-500">Showing the Erlangen demo area.</p>}
          </div>
          <main className="relative min-h-0 flex-1">
            {view === "map" ? map : <div className="h-full overflow-y-auto p-4">{list}</div>}
            <div className="absolute inset-x-4 top-4 z-[1000] space-y-2">
              {errorNote}
              {emptyState}
            </div>
          </main>
          <BottomSheet open={!!selected} onClose={closeListing}>{listingDetail}</BottomSheet>
          <BottomSheet open={!!selectedFridge} onClose={() => setSelectedFridge(null)}>{fridgeDetail}</BottomSheet>
        </>
      )}
    </div>
  );
}

function Panel(props: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  return (
    <SidePanel open={props.open} onClose={props.onClose} label={props.label}>
      {props.children}
    </SidePanel>
  );
}
