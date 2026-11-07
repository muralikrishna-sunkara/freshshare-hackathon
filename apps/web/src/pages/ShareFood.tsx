import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createListing, type Category, type Origin } from "../api/client";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { CATEGORY, ORIGIN } from "../lib/format";

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
  const [photo, setPhoto] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("leftovers");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [bestBefore, setBestBefore] = useState(isoDay(addDays(1)));
  const [windowIdx, setWindowIdx] = useState(1);
  const [portions, setPortions] = useState(1);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [handoverSpot, setHandoverSpot] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  const maxDate = origin === "homemade" ? isoDay(addDays(2)) : undefined;
  const allTicked = CHECKS.every((c) => checks[c.key]);
  const ready = !!photo && title.trim().length >= 3 && !!origin && !!bestBefore && allTicked;

  const m = useMutation({
    mutationFn: () => {
      const now = new Date();
      const w = WINDOWS[windowIdx];
      let until = new Date(now.getTime() + w.hours * 3600_000);
      if (w.hours === -1) {
        until = new Date(now);
        until.setHours(20, 0, 0, 0);
        if (until <= now) until = new Date(now.getTime() + 2 * 3600_000);
      }
      const f = new FormData();
      f.set("photo", photo!);
      f.set("title", title.trim());
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
      nav(`/map?listing=${l.id}`, { replace: true });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) m.mutate();
  };

  return (
    <Page title="Share food">
      <p className="mb-4 rounded-xl bg-brand-light p-3 text-sm text-brand-dark">
        Share in 30 seconds. Photo and date help neighbours trust your food.
      </p>
      <form onSubmit={submit} className="space-y-5">
        <label className="block cursor-pointer">
          <span className={labelCls}>Photo (required)</span>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-white">
            {preview ? (
              <img src={preview} alt="Your food" className="h-full w-full object-cover" />
            ) : (
              <span className="text-center text-stone-500">
                <span className="block text-4xl">📷</span>
                Take or choose a photo
              </span>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>

        <div>
          <label className={labelCls} htmlFor="title">What is it?</label>
          <input id="title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Vegetable lasagne, 3 portions" maxLength={80} />
        </div>

        <fieldset>
          <legend className={labelCls}>Category</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY) as Category[]).map((c) => (
              <button type="button" key={c} className={chipCls(category === c)} onClick={() => setCategory(c)} aria-pressed={category === c}>
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
          <legend className={labelCls}>Pickup</legend>
          <div className="flex flex-wrap gap-2">
            {WINDOWS.map((w, i) => (
              <button type="button" key={w.label} className={chipCls(windowIdx === i)} onClick={() => setWindowIdx(i)} aria-pressed={windowIdx === i}>
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>

        <details className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
          <summary className="cursor-pointer text-sm font-semibold text-stone-700">Allergens and handover spot (optional)</summary>
          <div className="mt-3 flex flex-wrap gap-2">
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
