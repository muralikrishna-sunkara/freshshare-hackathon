import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Footer } from "../components/Footer";
import { fetchFridges, fetchImpact, fetchListing, fetchNearby, type Category, type DietaryTag, type Fridge, type Listing } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { BottomSheet } from "../components/BottomSheet";
import { FridgeSheet } from "../components/FridgeSheet";
import { ListingActions } from "../components/ListingActions";
import { ListingCard } from "../components/ListingCard";
import { ListingMap } from "../components/ListingMap";
import { ListingTile } from "../components/ListingTile";
import { SidePanel } from "../components/SidePanel";
import { useLocation } from "../hooks/useLocation";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useMe } from "../hooks/useMe";
import { useSavedSearches } from "../hooks/useSavedSearches";
import { CATEGORY, DIETARY, FILL, formatDistance } from "../lib/format";
import { AddressSearch } from "../components/AddressSearch";
import { t, tn } from "../i18n";
import { FridgeIcon } from "../components/FridgeIcon";

const RADII = [1000, 2000, 5000, 10000] as const;
/** "Any distance": no km chip selected. The API caps this at 50 km and the list is nearest first. */
const ANY_RADIUS = 50000;
const chipBase = "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition min-h-[40px]";
const chipOn = "bg-brand-dark text-white";
const chipOff = "bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50";

type SortKey = "nearest" | "soonest" | "newest";
const SORTS: Record<SortKey, { label: string; compare: (a: Listing, b: Listing) => number }> = {
  nearest: { label: t("Nearest first"), compare: (a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0) },
  soonest: { label: t("Pickup ends soonest"), compare: (a, b) => +new Date(a.pickupUntil) - +new Date(b.pickupUntil) },
  newest: { label: t("Newest first"), compare: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt) },
};

export function MapHome() {
  const device = useLocation();
  const isDesktop = useIsDesktop();
  const [selected, setSelected] = useState<Listing | null>(null);
  const [selectedFridge, setSelectedFridge] = useState<Fridge | null>(null);
  const [params, setParams] = useSearchParams();
  // Filters live in the URL so a filtered view can be shared or bookmarked.
  // No ?km means any distance; tapping the selected km chip again clears it.
  const radiusParam = Number(params.get("km")) * 1000;
  const kmFilter: number | null = (RADII as readonly number[]).includes(radiusParam) ? radiusParam : null;
  const radius = kmFilter ?? ANY_RADIUS;
  const category = (params.get("category") as Category | null) ?? undefined;
  const diet = (params.get("diet") as DietaryTag | null) ?? undefined;
  const showFridges = params.get("fridges") !== "0";
  // "Search this area" / place search (T2.8): ?at=lat,lng overrides the device or demo location.
  const atMatch = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(params.get("at") ?? "");
  const at = atMatch ? { lat: Number(atMatch[1]), lng: Number(atMatch[2]) } : null;
  const loc: { lat: number; lng: number; source: "device" | "demo" | "area" } = at ? { ...at, source: "area" } : device;
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
  const setArea = (c: { lat: number; lng: number } | null) => setFilter("at", c ? `${c.lat.toFixed(5)},${c.lng.toFixed(5)}` : undefined);
  const setRadius = (r: number | null) => setFilter("km", r === null ? undefined : String(r / 1000));
  const setCategory = (c: Category | undefined) => setFilter("category", c);
  const setDiet = (d: DietaryTag | undefined) => setFilter("diet", d);
  const setShowFridges = (f: (v: boolean) => boolean) => setFilter("fridges", f(showFridges) ? undefined : "0");
  // Map or list view, and the list's sort order, are in the URL too (?view=list&sort=soonest).
  // The list is the default; ?view=map opens the map.
  const view: "map" | "list" = params.get("view") === "map" ? "map" : "list";
  const setView = (v: "map" | "list") => setFilter("view", v === "map" ? "map" : undefined);
  const sortParam = params.get("sort");
  const sort: SortKey = sortParam === "soonest" || sortParam === "newest" ? sortParam : "nearest";
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
  const q = params.get("q") ?? "";
  const needle = q.trim().toLowerCase();
  const sorted = [...listings]
    .filter((l) => !needle || [l.title, l.description, CATEGORY[l.category].label, l.areaLabel, l.giver.name, l.fridge?.name].some((t) => t?.toLowerCase().includes(needle)))
    .sort(SORTS[sort].compare);
  const saved = useSavedSearches();
  const searchName = [
    q && `“${q}”`,
    category && CATEGORY[category].label,
    diet && DIETARY[diet],
    kmFilter && formatDistance(kmFilter),
    sort !== "nearest" && SORTS[sort].label.toLowerCase(),
  ].filter(Boolean).join(" · ");
  const searchQuery = (() => {
    const n = new URLSearchParams(params);
    n.delete("listing");
    n.delete("view");
    return n.toString();
  })();
  const fridges = fridgesQ.data ?? [];
  const radiusLabel = kmFilter ? formatDistance(kmFilter) : null;
  const withinLabel = radiusLabel ? t("within {d}", { d: radiusLabel }) : t("nearby, nearest first");
  const countLabel = listingsQ.isLoading
    ? t("Finding food nearby…")
    : `${tn("{n} listing", "{n} listings", listings.length)} ${withinLabel}`;

  const impactBanner = (
    <p className="rounded-xl bg-brand-light px-3 py-2 text-sm text-brand-dark" aria-live="polite">
      {impactQ.data ? (
        <>
          🌱 {t("This week your neighbourhood saved")} <strong>{tn("{n} portion", "{n} portions", impactQ.data.week.portions)}</strong> ({t("~{kg} kg, estimate", { kg: impactQ.data.week.kg })})
        </>
      ) : (
        `🌱 ${t("Counting this week's saved food…")}`
      )}
    </p>
  );

  const renderFilters = (wrap: boolean) => (
    <div className={wrap ? "flex flex-wrap gap-2" : "-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5"}>
      <button onClick={() => setRadius(null)} className={`${chipBase} ${kmFilter === null ? chipOn : chipOff}`} aria-pressed={kmFilter === null}>
        {t("Any distance")}
      </button>
      {RADII.map((r) => (
        <button key={r} onClick={() => setRadius(kmFilter === r ? null : r)} className={`${chipBase} ${kmFilter === r ? chipOn : chipOff}`} aria-pressed={kmFilter === r}>
          {formatDistance(r)}
        </button>
      ))}
      <button onClick={() => setShowFridges((v) => !v)} className={`${chipBase} ${showFridges ? chipOn : chipOff}`} aria-pressed={showFridges}>
        <FridgeIcon className="mr-1 h-4 w-4" />{t("Fridges")}
      </button>
      {!wrap && <span className="mx-1 w-px shrink-0 bg-stone-200" />}
      {wrap && <span className="basis-full" />}
      <button onClick={() => setCategory(undefined)} className={`${chipBase} ${!category ? chipOn : chipOff}`} aria-pressed={!category}>
        {t("All")}
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
      {!wrap && <span className="mx-1 w-px shrink-0 bg-stone-200" />}
      <select
        aria-label={t("Dietary")}
        value={diet ?? ""}
        onChange={(e) => setDiet((e.target.value || undefined) as DietaryTag | undefined)}
        className={`${chipBase} ${diet ? chipOn : chipOff} pr-8`}
      >
        <option value="">{t("Any diet")}</option>
        {(Object.keys(DIETARY) as DietaryTag[]).map((d) => (
          <option key={d} value={d}>{DIETARY[d]}</option>
        ))}
      </select>
    </div>
  );
  const filters = renderFilters(isDesktop);
  const placeSearch = (
    <div className="flex items-end gap-2">
      <AddressSearch label={t("Search a place")} hideLabel placeholder={`📍 ${t("Search a street or place")}`} near={loc} onPick={(p) => setArea(p)} className="min-w-0 flex-1" />
      {at && (
        <button type="button" onClick={() => setArea(null)} className={`${chipBase} ${chipOff} shrink-0`}>
          {device.source === "device" ? t("Back to my location") : t("Back to demo area")}
        </button>
      )}
    </div>
  );

  const viewToggle = (
    <div className="flex shrink-0 rounded-full bg-stone-100 p-1 text-sm font-semibold" role="tablist" aria-label={t("View")}>
      {(["map", "list"] as const).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          onClick={() => setView(v)}
          className={`min-h-[36px] rounded-full px-4 ${view === v ? "bg-white text-stone-900 shadow" : "text-stone-500 hover:text-stone-800"}`}
        >
          {v === "map" ? `🗺 ${t("Map")}` : `☰ ${t("List")}`}
        </button>
      ))}
    </div>
  );

  const sortSelect = (
    <label className="flex items-center gap-2 text-sm text-stone-600">
      {t("Sort")}
      <select value={sort} onChange={(e) => setFilter("sort", e.target.value === "nearest" ? undefined : e.target.value)} className="min-h-[40px] rounded-full bg-white px-3 font-semibold text-stone-800 ring-1 ring-stone-300">
        {(Object.keys(SORTS) as SortKey[]).map((k) => (
          <option key={k} value={k}>{SORTS[k].label}</option>
        ))}
      </select>
    </label>
  );

  const browseGrid = (
    <div className="space-y-6">
      {(listingsQ.isLoading || sorted.length > 0) && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {listingsQ.isLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-96 animate-pulse rounded-2xl bg-stone-200" />)}
          {sorted.map((l) => (
            <ListingTile key={l.id} listing={l} selected={selected?.id === l.id} onOpen={() => openListing(l)} />
          ))}
        </div>
      )}
      {!listingsQ.isLoading && listings.length > 0 && sorted.length === 0 && (
        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-stone-200">
          <p className="font-semibold">{t("No listings match “{q}”.", { q })}</p>
          <button className="mt-2 text-sm font-semibold text-brand-dark underline" onClick={() => setFilter("q", undefined)}>{t("Clear search")}</button>
        </div>
      )}
      {showFridges && fridges.length > 0 && !listingsQ.isLoading && (
        <section aria-label={t("Community fridges nearby")}>
          <h2 className="mb-3 font-bold">{t("Community fridges nearby ({n})", { n: fridges.length })}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {fridges.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => openFridge(f)} className="flex w-full gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-stone-200 hover:ring-brand">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-light text-2xl text-brand-dark" aria-hidden><FridgeIcon className="h-7 w-7" /></span>
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-bold">{f.name}</span>
                    <span className="block text-stone-600">{t("{d} away", { d: formatDistance(f.distanceM) })} · {f.openingHours}</span>
                    <span className="block text-stone-500">
                      {f.lastCheckIn?.fillLevel ? t("Last check-in: {state}", { state: FILL[f.lastCheckIn.fillLevel].label }) : f.lastCheckIn ? t("Last check-in: {state}", { state: t(f.lastCheckIn.state) }) : t("No check-ins yet")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
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

  const nextRadius = kmFilter === null ? undefined : RADII.find((r) => r > kmFilter);
  const filtered = !!category || !!diet;
  const emptyState = !listingsQ.isLoading && !listingsQ.isError && listings.length === 0 && (
    <div className="space-y-3 rounded-2xl bg-white p-4 text-center shadow-lg ring-1 ring-stone-200">
      <div>
        <p className="font-semibold">{filtered ? t("Nothing matching your filters {where} right now.", { where: radiusLabel ? withinLabel : t("nearby") }) : t("Nothing {where} right now.", { where: radiusLabel ? withinLabel : t("nearby") })}</p>
        <p className="text-sm text-stone-600">
          {fridges.length > 0
            ? tn("There is 1 community fridge nearby. It is on the map.", "There are {n} community fridges nearby. They are on the map.", fridges.length)
            : t("New food is posted every day. Check back later.")}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        {filtered && (
          <button className="min-h-[40px] rounded-full px-4 font-semibold ring-1 ring-stone-300" onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete("category"); n.delete("diet"); return n; }, { replace: true })}>
            {t("Clear filters")}
          </button>
        )}
        {kmFilter !== null && (
          <button className="min-h-[40px] rounded-full bg-brand-dark px-4 font-bold text-white" onClick={() => setRadius(nextRadius ?? null)}>
            {nextRadius ? t("Search {d}", { d: formatDistance(nextRadius) }) : t("Any distance")}
          </button>
        )}
        <Link to="/share" className="min-h-[40px] rounded-full bg-accent px-4 py-2 font-bold text-white">{t("Share food")}</Link>
      </div>
    </div>
  );

  const errorNote = listingsQ.isError && (
    <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow">
      {t("Could not load food nearby.")}{" "}
      <button className="font-semibold underline" onClick={() => listingsQ.refetch()}>
        {t("Try again")}
      </button>
    </div>
  );

  const map = (
    <ListingMap
      centre={loc}
      radius={kmFilter ?? 2000}
      listings={listings}
      fridges={showFridges ? fridges : []}
      onSelect={openListing}
      onSelectFridge={openFridge}
      focus={focusQ.data ? { lat: focusQ.data.publicLat, lng: focusQ.data.publicLng } : undefined}
      onSearchArea={setArea}
    />
  );

  const listingDetail = selected && (
    <>
      <ListingCard listing={selected} />
      <ListingActions listing={selected} />
    </>
  );
  const fridgeDetail = selectedFridge && <FridgeSheet fridge={fridges.find((f) => f.id === selectedFridge.id) ?? selectedFridge} />;

  const card = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200";
  const browsePage = (
    <main className="relative min-h-0 flex-1">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{t("Browse food")}</h1>
              <p className="text-stone-600">{radiusLabel ? t("Free food shared by your neighbours within {d}.", { d: radiusLabel }) : t("Free food shared by your neighbours near you, nearest first.")}{loc.source === "demo" ? ` ${t("Erlangen demo area.")}` : ""}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setView("map")} className="min-h-[44px] rounded-xl bg-white px-4 font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50">📍 {t("Map view")}</button>
              <Link to="/share" className="flex min-h-[44px] items-center rounded-xl bg-brand-dark px-4 font-bold text-white hover:brightness-110">{t("Share food")}</Link>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <section className={card} aria-labelledby="filters-h">
                <h2 id="filters-h" className="mb-3 font-bold">{t("Filters")}</h2>
                {renderFilters(true)}
              </section>
              <section className={`${card} ${saved.items.length === 0 ? "hidden lg:block" : ""}`} aria-labelledby="saved-h">
                <h2 id="saved-h" className="mb-2 font-bold">🔖 {t("Saved searches")} <span className="text-sm font-normal text-stone-500">({saved.items.length})</span></h2>
                {saved.items.length === 0 ? (
                  <p className="py-3 text-center text-sm text-stone-500">{t("No saved searches yet. Use Save to keep these filters.")}</p>
                ) : (
                  <ul className="space-y-1">
                    {saved.items.map((s) => (
                      <li key={s.id} className="flex items-center gap-1">
                        <button className="min-h-[36px] flex-1 truncate rounded-lg px-2 text-left text-sm font-semibold text-brand-dark hover:bg-stone-50" onClick={() => setParams(new URLSearchParams(s.query), { replace: true })}>
                          {s.name}
                        </button>
                        <button aria-label={t("Delete saved search {name}", { name: s.name })} className="h-8 w-8 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700" onClick={() => saved.remove(s.id)}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <div className="hidden lg:block">{impactBanner}</div>
            </aside>
            <div className="min-w-0 space-y-4">
              <div className={`${card} flex flex-wrap items-center gap-3`}>
                <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-xl bg-stone-50 px-3 ring-1 ring-stone-200 focus-within:ring-brand">
                  <span aria-hidden>🔍</span>
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setFilter("q", e.target.value || undefined)}
                    placeholder={t("Search food, area or neighbour")}
                    aria-label={t("Search listings")}
                    className="min-h-[44px] w-full bg-transparent text-sm outline-none"
                  />
                </label>
                {sortSelect}
                <button
                  onClick={() => saved.save(searchName, searchQuery)}
                  disabled={saved.items.some((s) => s.query === searchQuery)}
                  className="min-h-[40px] rounded-full px-3 text-sm font-semibold text-brand-dark ring-1 ring-brand/40 hover:bg-brand-light disabled:opacity-50"
                >
                  {saved.items.some((s) => s.query === searchQuery) ? `✓ ${t("Saved")}` : `🔖 ${t("Save")}`}
                </button>
              </div>
              <p className="text-sm text-stone-600">{listingsQ.isLoading ? t("Finding food nearby…") : `${tn("{n} listing found", "{n} listings found", sorted.length)} ${withinLabel}`}</p>
              {errorNote}
              {emptyState}
              {browseGrid}
            </div>
          </div>
        </div>
        <Footer />
      </div>
      {isDesktop && (
        <div className="pointer-events-none fixed inset-y-0 right-0 top-16 z-[1050] w-[460px]">
          <div className="pointer-events-auto">
            <Panel open={!!selected} onClose={closeListing} label={t("Listing details")}>{listingDetail}</Panel>
            <Panel open={!!selectedFridge} onClose={() => setSelectedFridge(null)} label={t("Community fridge")}>{fridgeDetail}</Panel>
          </div>
        </div>
      )}
    </main>
  );


  if (view === "list") {
    return (
      <div className="flex h-full w-full flex-col bg-stone-50">
        <AppHeader />
        {browsePage}
        {!isDesktop && (
          <>
            <BottomSheet open={!!selected} onClose={closeListing}>{listingDetail}</BottomSheet>
            <BottomSheet open={!!selectedFridge} onClose={() => setSelectedFridge(null)}>{fridgeDetail}</BottomSheet>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-stone-50">
      <AppHeader />
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[420px] shrink-0 flex-col border-r border-stone-200 bg-white">
            <div className="space-y-3 border-b border-stone-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">{t("Free food near you")}</h1>
                {viewToggle}
              </div>
              {impactBanner}
              {placeSearch}
              {filters}
              {loc.source === "demo" && <p className="text-xs text-stone-500">{t("Showing the Erlangen demo area.")}</p>}
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
            <Panel open={!!selected} onClose={closeListing} label={t("Listing details")}>{listingDetail}</Panel>
            <Panel open={!!selectedFridge} onClose={() => setSelectedFridge(null)} label={t("Community fridge")}>{fridgeDetail}</Panel>
          </main>
        </div>
      ) : (
        <>
          <div className="z-[1000] space-y-2 bg-white px-4 pb-3 pt-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-stone-700">{countLabel}</p>
              {viewToggle}
            </div>
            {placeSearch}
            {filters}
            {loc.source === "demo" && <p className="text-xs text-stone-500">{t("Showing the Erlangen demo area.")}</p>}
          </div>
          <main className="relative min-h-0 flex-1">
            {map}
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
