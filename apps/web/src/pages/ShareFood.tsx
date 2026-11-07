import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createListing, fetchFridges, fetchListing, type Category, type DietaryTag, type Origin } from "../api/client";
import { useMe } from "../hooks/useMe";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { CATEGORY, DIETARY, ORIGIN } from "../lib/format";

const MAX_PHOTOS = 4;

/** Quick posting: picking a category pre-fills sensible defaults the giver can still change. */
const TEMPLATES: Record<Category, { placeholder: string; origin?: Origin; dietary: DietaryTag[]; allergens: string[]; bestBeforeDays: number }> = {
  leftovers: { placeholder: "e.g. Vegetable lasagne, 3 portions", origin: "homemade", dietary: ["vegetarian"], allergens: [], bestBeforeDays: 1 },
  fruit_veg: { placeholder: "e.g. Bag of apples from our tree", origin: "fresh_produce", dietary: ["vegan", "vegetarian", "gluten_free", "lactose_free", "nut_free"], allergens: [], bestBeforeDays: 3 },
  bread: { placeholder: "e.g. 4 bread rolls from this morning", origin: "packaged", dietary: ["vegetarian", "vegan"], allergens: ["gluten"], bestBeforeDays: 1 },
  packaged: { placeholder: "e.g. 2 tins of chickpeas", origin: "packaged", dietary: [], allergens: [], bestBeforeDays: 30 },
  dairy: { placeholder: "e.g. Natural yoghurt, 500 g", origin: "packaged", dietary: ["vegetarian", "gluten_free"], allergens: ["milk"], bestBeforeDays: 2 },
  other: { placeholder: "e.g. Box of herbal tea", dietary: [], allergens: [], bestBeforeDays: 7 },
};

const ALLERGENS = ["gluten", "milk", "eggs", "nuts", "peanuts", "soy", "sesame", "celery", "mustard", "fish"];
const CHECKS = [
  { key: "storedCold", label: "Stored cold (or doesn't need the fridge)" },
  { key: "notPastDate", label: "Not past its date" },
  { key: "wouldEatIt", label: "I would eat it myself" },
] as const;
const WINDOWS = [
  { label: "Next 2 h", hours: 2 },
  { label: "Next 4 h", hours: 4 },
  { label: "Until 20:00", hours: -1 },
  { label: "24 h", hours: 24 },
];

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const chipCls = (on: boolean) =>
  `min-h-[44px] rounded-full px-4 text-sm font-semibold ${on ? "bg-brand-dark text-white" : "bg-white text-stone-700 ring-1 ring-stone-300"}`;

export function ShareFood() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const fromId = params.get("from");
  const [photos, setPhotos] = useState<File[]>([]);
  const [reusePhotos, setReusePhotos] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dietary, setDietary] = useState<DietaryTag[]>([]);
  const [weight, setWeight] = useState("");
  const me = useMe();
  const [place, setPlace] = useState<"home" | "fridge">(params.get("fridge") ? "fridge" : "home");
  const [fridgeId, setFridgeId] = useState(params.get("fridge") ?? "");
  const fridgesQ = useQuery({
    queryKey: ["fridges", "share", me.data?.homeLat, me.data?.homeLng],
    queryFn: () => fetchFridges(me.data!.homeLat, me.data!.homeLng, 10000),
    enabled: !!me.data && place === "fridge",
  });
  const [category, setCategory] = useState<Category>("leftovers");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [bestBefore, setBestBefore] = useState(isoDay(addDays(1)));
  const [windowIdx, setWindowIdx] = useState(1);
  const [portions, setPortions] = useState(1);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [handoverSpot, setHandoverSpot] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const shownPhotos = previews.length ? previews : reusePhotos;

  // "Post again": copy fields and photos from one of my earlier listings, with fresh dates.
  const fromQ = useQuery({ queryKey: ["listing", fromId, "repost"], queryFn: () => fetchListing(fromId!), enabled: !!fromId });
  useEffect(() => {
    const l = fromQ.data;
    if (!l || !l.isMine) return;
    setTitle(l.title);
    setDescription(l.description ?? "");
    setCategory(l.category);
    setOrigin(l.origin);
    setPortions(l.portions);
    setAllergens(l.allergens);
    setDietary(l.dietaryTags ?? []);
    setWeight(l.weightKg ? String(l.weightKg) : "");
    setHandoverSpot(l.handoverSpot ?? "");
    setReusePhotos(l.photos?.length ? l.photos : [l.photoUrl]);
    setBestBefore(isoDay(addDays(TEMPLATES[l.category].bestBeforeDays)));
  }, [fromQ.data]);

  const applyTemplate = (c: Category) => {
    setCategory(c);
    const t = TEMPLATES[c];
    if (t.origin) setOrigin(t.origin);
    setDietary(t.dietary);
    setAllergens(t.allergens);
    setBestBefore(isoDay(addDays(t.origin === "homemade" ? Math.min(t.bestBeforeDays, 2) : t.bestBeforeDays)));
    setWindowIdx(2);
  };
  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    setPhotos((ps) => [...ps, ...Array.from(files)].slice(0, MAX_PHOTOS));
  };

  const maxDate = origin === "homemade" ? isoDay(addDays(2)) : undefined;
  const allTicked = CHECKS.every((c) => checks[c.key]);
  const hasPhoto = photos.length > 0 || reusePhotos.length > 0;
  const ready = hasPhoto && (place === "home" || !!fridgeId) && title.trim().length >= 3 && !!origin && !!bestBefore && allTicked;

  const m = useMutation({
    mutationFn: () => {
      const now = new Date();
      const w = WINDOWS[windowIdx];
      let until = new Date(now.getTime() + w.hours * 3600_000);
      if (w.hours === -1) {
        // Until 20:00 today, or 20:00 tomorrow when it's already past 18:00.
        until = new Date(now);
        until.setHours(20, 0, 0, 0);
        if (now.getHours() >= 18) until.setDate(until.getDate() + 1);
      }
      const f = new FormData();
      for (const p of photos) f.append("photos", p);
      if (!photos.length && fromId) f.set("fromListingId", fromId);
      f.set("title", title.trim());
      if (description.trim()) f.set("description", description.trim());
      if (dietary.length) f.set("dietaryTags", dietary.join(","));
      if (weight) f.set("weightKg", weight);
      if (place === "fridge" && fridgeId) f.set("fridgeId", fridgeId);
      f.set("category", category);
      f.set("origin", origin!);
      f.set("bestBefore", new Date(`${bestBefore}T23:59:00`).toISOString());
      f.set("pickupFrom", now.toISOString());
      f.set("pickupUntil", until.toISOString());
      f.set("portions", String(portions));
      f.set("allergens", allergens.join(","));
      if (handoverSpot.trim()) f.set("handoverSpot", handoverSpot.trim());
      for (const c of CHECKS) f.set(c.key, String(!!checks[c.key]));
      return createListing(f);
    },
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      nav(`/map?listing=${l.id}`, { replace: true });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) m.mutate();
  };

  return (
    <Page title={fromId ? "Post again" : "Share food"}>
      <p className="mb-4 rounded-xl bg-brand-light p-3 text-sm text-brand-dark">
        {fromId
          ? "We copied your earlier listing with fresh dates. Check it and post."
          : "Share in 30 seconds. Pick a category and we fill in the usual details for you."}
      </p>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <span className={labelCls}>Photos (at least 1, up to {MAX_PHOTOS})</span>
          {shownPhotos.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {shownPhotos.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
                  <img src={src} alt={i === 0 ? "Main photo" : `Photo ${i + 1}`} className="h-full w-full object-cover" />
                  {previews.length > 0 && (
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {previews.length > 0 && previews.length < MAX_PHOTOS && (
                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white text-2xl text-stone-500">
                  +
                  <input type="file" accept="image/*" multiple className="sr-only" aria-label="Add another photo" onChange={(e) => addPhotos(e.target.files)} />
                </label>
              )}
            </div>
          ) : null}
          {(shownPhotos.length === 0 || reusePhotos.length > 0 && previews.length === 0) && (
            <label className="mt-2 block cursor-pointer">
              <div className={`flex items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-white ${shownPhotos.length ? "py-3" : "aspect-[4/3]"}`}>
                <span className="text-center text-stone-500">
                  {!shownPhotos.length && <span className="block text-4xl">📷</span>}
                  {shownPhotos.length ? "Use new photos instead" : "Take or choose photos"}
                </span>
              </div>
              <input type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label="Photo" onChange={(e) => addPhotos(e.target.files)} />
            </label>
          )}
        </div>

        <div>
          <label className={labelCls} htmlFor="title">What is it?</label>
          <input id="title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={TEMPLATES[category].placeholder} maxLength={80} />
        </div>

        <fieldset>
          <legend className={labelCls}>Category</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY) as Category[]).map((c) => (
              <button type="button" key={c} className={chipCls(category === c)} onClick={() => applyTemplate(c)} aria-pressed={category === c}>
                {CATEGORY[c].emoji} {CATEGORY[c].label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelCls}>Label (required)</legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ORIGIN) as Origin[]).map((o) => (
              <button
                type="button"
                key={o}
                onClick={() => setOrigin(o)}
                aria-pressed={origin === o}
                className={`min-h-[52px] rounded-xl px-2 text-sm font-semibold ${origin === o ? "bg-brand-dark text-white" : "bg-white ring-1 ring-stone-300"}`}
              >
                {ORIGIN[o]}
              </button>
            ))}
          </div>
          {origin === "homemade" && <p className="mt-1 text-xs text-stone-500">Homemade food stays on the map for up to 48 hours.</p>}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="bb">Best before (required)</label>
            <input
              id="bb"
              type="date"
              className={inputCls}
              value={bestBefore}
              min={isoDay(new Date())}
              max={maxDate}
              onChange={(e) => setBestBefore(e.target.value)}
              required
            />
          </div>
          <div>
            <span className={labelCls}>Portions</span>
            <div className="flex items-center justify-between rounded-xl border border-stone-300 bg-white">
              <button type="button" className="h-12 w-12 text-xl" onClick={() => setPortions((p) => Math.max(1, p - 1))} aria-label="Fewer portions">−</button>
              <span className="text-base font-semibold" aria-live="polite">{portions}</span>
              <button type="button" className="h-12 w-12 text-xl" onClick={() => setPortions((p) => Math.min(50, p + 1))} aria-label="More portions">+</button>
            </div>
          </div>
        </div>

        <fieldset>
          <legend className={labelCls}>Where</legend>
          <div className="grid grid-cols-2 gap-2">
            {([["home", "🏠 From my home"], ["fridge", "🧊 Drop at a community fridge"]] as const).map(([v, label]) => (
              <button type="button" key={v} onClick={() => setPlace(v)} aria-pressed={place === v} className={`min-h-[52px] rounded-xl px-2 text-sm font-semibold ${place === v ? "bg-brand-dark text-white" : "bg-white ring-1 ring-stone-300"}`}>
                {label}
              </button>
            ))}
          </div>
          {place === "home" ? (
            <p className="mt-1 text-xs text-stone-500">Neighbours see only your area until you confirm their pickup.</p>
          ) : (
            <div className="mt-2">
              <label className="sr-only" htmlFor="fridge">Community fridge</label>
              <select id="fridge" className={inputCls} value={fridgeId} onChange={(e) => setFridgeId(e.target.value)}>
                <option value="">Pick a fridge</option>
                {fridgesQ.data?.map((fr) => (
                  <option key={fr.id} value={fr.id}>{fr.name} · {fr.address}</option>
                ))}
              </select>
              {fridgesQ.data?.length === 0 && <p className="mt-1 text-xs text-stone-500">No approved fridges within 10 km of your home pin.</p>}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className={labelCls}>Pickup</legend>
          <div className="flex flex-wrap gap-2">
            {WINDOWS.map((w, i) => (
              <button type="button" key={w.label} className={chipCls(windowIdx === i)} onClick={() => setWindowIdx(i)} aria-pressed={windowIdx === i}>
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelCls}>Dietary</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DIETARY) as DietaryTag[]).map((d) => {
              const on = dietary.includes(d);
              return (
                <button type="button" key={d} className={chipCls(on)} aria-pressed={on} onClick={() => setDietary((xs) => (on ? xs.filter((x) => x !== d) : [...xs, d]))}>
                  {DIETARY[d]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <details className="rounded-xl bg-white p-3 ring-1 ring-stone-200" open={!!fromId}>
          <summary className="cursor-pointer text-sm font-semibold text-stone-700">Description, allergens, weight and handover spot (optional)</summary>
          <label className={`${labelCls} mt-3`} htmlFor="desc">Description</label>
          <textarea id="desc" rows={2} maxLength={500} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anything neighbours should know: ingredients, how it was stored…" />
          <label className={`${labelCls} mt-3`} htmlFor="weight">About how much does it weigh? (kg)</label>
          <input id="weight" type="number" inputMode="decimal" min={0.05} max={50} step={0.1} className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 0.8" />
          <span className={`${labelCls} mt-3`}>Allergens</span>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => {
              const on = allergens.includes(a);
              return (
                <button
                  type="button"
                  key={a}
                  className={chipCls(on)}
                  aria-pressed={on}
                  onClick={() => setAllergens((xs) => (on ? xs.filter((x) => x !== a) : [...xs, a]))}
                >
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              );
            })}
          </div>
          <label className={`${labelCls} mt-4`} htmlFor="spot">Public handover spot</label>
          <input id="spot" className={inputCls} value={handoverSpot} onChange={(e) => setHandoverSpot(e.target.value)} placeholder="e.g. Bakery at the Hauptstraße corner" maxLength={120} />
        </details>

        <fieldset className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <legend className="px-1 text-sm font-bold text-stone-800">Safety checklist</legend>
          {CHECKS.map((c) => (
            <label key={c.key} className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-6 w-6 accent-[#1f4337]"
                checked={!!checks[c.key]}
                onChange={(e) => setChecks((s) => ({ ...s, [c.key]: e.target.checked }))}
              />
              <span className="text-base">{c.label}</span>
            </label>
          ))}
        </fieldset>

        <ErrorNote error={m.error} />
        <button className={primaryBtn} disabled={!ready || m.isPending}>
          {m.isPending ? "Posting…" : "Post to the map"}
        </button>
        {!ready && (
          <p className="text-center text-xs text-stone-500">
            Needs a photo, a title, a label, a date and all three safety ticks.
          </p>
        )}
      </form>
    </Page>
  );
}
