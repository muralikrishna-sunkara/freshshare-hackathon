import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createListing, fetchAiStatus, fetchFridges, fetchListing, suggestFromPhoto, updateListing, type Category, type DietaryTag, type Origin } from "../api/client";
import { useMe } from "../hooks/useMe";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { FieldError } from "../components/States";

/** Red asterisk for required fields; hidden from screen readers, which get aria-required instead. */
const Req = () => <span aria-hidden className="text-red-700"> *</span>;
import { locale, t } from "../i18n";
import { allergenLabel, CATEGORY, DIETARY, ORIGIN } from "../lib/format";

const MAX_PHOTOS = 4;

/** Quick posting: picking a category pre-fills sensible defaults the giver can still change. */
const TEMPLATES: Record<Category, { placeholder: string; origin?: Origin; dietary: DietaryTag[]; allergens: string[]; bestBeforeDays: number }> = {
  leftovers: { placeholder: t("e.g. Vegetable lasagne, 3 portions"), origin: "homemade", dietary: ["vegetarian"], allergens: [], bestBeforeDays: 1 },
  fruit_veg: { placeholder: t("e.g. Bag of apples from our tree"), origin: "fresh_produce", dietary: ["vegan", "vegetarian", "gluten_free", "lactose_free", "nut_free"], allergens: [], bestBeforeDays: 3 },
  bread: { placeholder: t("e.g. 4 bread rolls from this morning"), origin: "packaged", dietary: ["vegetarian", "vegan"], allergens: ["gluten"], bestBeforeDays: 1 },
  packaged: { placeholder: t("e.g. 2 tins of chickpeas"), origin: "packaged", dietary: [], allergens: [], bestBeforeDays: 30 },
  dairy: { placeholder: t("e.g. Natural yoghurt, 500 g"), origin: "packaged", dietary: ["vegetarian", "gluten_free"], allergens: ["milk"], bestBeforeDays: 2 },
  other: { placeholder: t("e.g. Box of herbal tea"), dietary: [], allergens: [], bestBeforeDays: 7 },
};

const ALLERGENS = ["gluten", "milk", "eggs", "nuts", "peanuts", "soy", "sesame", "celery", "mustard", "fish"];
const CHECKS = [
  { key: "storedCold", label: t("Stored cold (or doesn't need the fridge)") },
  { key: "notPastDate", label: t("Not past its date") },
  { key: "wouldEatIt", label: t("I would eat it myself") },
] as const;
const WINDOWS = [
  { label: t("Next 2 h"), hours: 2 },
  { label: t("Next 4 h"), hours: 4 },
  { label: t("Until 20:00"), hours: -1 },
  { label: t("24 h"), hours: 24 },
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
  // ?edit=<id>: change one of my listings in place; ?from=<id>: "Post again" as a new listing.
  const editId = params.get("edit");
  const fromId = editId ? null : params.get("from");
  const sourceId = editId ?? fromId;
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
  // -1 = keep the current pickup time (edit mode only).
  const [windowIdx, setWindowIdx] = useState(editId ? -1 : 1);
  const [portions, setPortions] = useState(1);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [handoverSpot, setHandoverSpot] = useState("");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [tried, setTried] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const shownPhotos = previews.length ? previews : reusePhotos;

  // "Post again": copy fields and photos from one of my earlier listings, with fresh dates.
  const fromQ = useQuery({ queryKey: ["listing", sourceId, editId ? "edit" : "repost"], queryFn: () => fetchListing(sourceId!), enabled: !!sourceId });
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
    setPickupInstructions(l.pickupInstructions ?? "");
    setReusePhotos(l.photos?.length ? l.photos : [l.photoUrl]);
    setBestBefore(editId ? isoDay(new Date(l.bestBefore)) : isoDay(addDays(TEMPLATES[l.category].bestBeforeDays)));
  }, [fromQ.data, editId]);
  const editable = !editId || (fromQ.data?.isMine && fromQ.data.status === "available");

  const applyTemplate = (c: Category) => {
    setCategory(c);
    const t = TEMPLATES[c];
    if (t.origin) setOrigin(t.origin);
    setDietary(t.dietary);
    setAllergens(t.allergens);
    setBestBefore(isoDay(addDays(t.origin === "homemade" ? Math.min(t.bestBeforeDays, 2) : t.bestBeforeDays)));
    setWindowIdx(2);
  };
  // K1: "Fill from photo" only when the server has an AI key.
  const aiQ = useQuery({ queryKey: ["ai-status"], queryFn: fetchAiStatus, staleTime: 5 * 60_000 });
  const autofill = useMutation({
    mutationFn: (file: File) => suggestFromPhoto(file),
    onSuccess: (s) => {
      applyTemplate(s.category);
      setTitle(s.title);
      setOrigin(s.origin);
      setDietary(s.dietaryTags);
      setAllergens(s.allergens.filter((a) => ALLERGENS.includes(a)));
      if (s.origin === "homemade") setBestBefore(isoDay(addDays(1)));
    },
  });
  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const first = photos.length === 0 ? files[0] : null;
    setPhotos((ps) => [...ps, ...Array.from(files)].slice(0, MAX_PHOTOS));
    // Fill from photo runs by itself on the first photo of a new listing; the button stays for a retry.
    if (first && !editId && aiQ.data?.photoAutofill && !autofill.isPending) autofill.mutate(first);
  };

  const maxDate = origin === "homemade" ? isoDay(addDays(2)) : undefined;
  const allTicked = CHECKS.every((c) => checks[c.key]);
  const hasPhoto = photos.length > 0 || reusePhotos.length > 0;
  const errors = {
    photo: hasPhoto ? undefined : t("Add at least one photo."),
    title: title.trim().length >= 3 ? undefined : t("Give it a short title (at least 3 letters)."),
    origin: origin ? undefined : t("Choose Homemade, Packaged or Fresh produce."),
    bestBefore: bestBefore ? undefined : t("Pick a best-before date."),
    fridge: editId || place === "home" || fridgeId ? undefined : t("Pick a community fridge."),
    checks: allTicked ? undefined : t("Tick all three safety checks."),
  };
  const ready = Object.values(errors).every((e) => !e);
  const err = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  const m = useMutation({
    mutationFn: () => {
      const now = new Date();
      const f = new FormData();
      for (const p of photos) f.append("photos", p);
      f.set("title", title.trim());
      f.set("description", description.trim());
      if (pickupInstructions.trim() || editId) f.set("pickupInstructions", pickupInstructions.trim());
      if (editId) {
        f.set("dietaryTags", dietary.join(","));
        f.set("weightKg", weight);
        f.set("handoverSpot", handoverSpot.trim());
      }
      f.set("category", category);
      f.set("origin", origin!);
      f.set("bestBefore", new Date(`${bestBefore}T23:59:00`).toISOString());
      f.set("portions", String(portions));
      f.set("allergens", allergens.join(","));
      for (const c of CHECKS) f.set(c.key, String(!!checks[c.key]));
      if (editId && windowIdx === -1) return updateListing(editId, f);
      const w = WINDOWS[windowIdx];
      let until = new Date(now.getTime() + w.hours * 3600_000);
      if (w.hours === -1) {
        // Until 20:00 today, or 20:00 tomorrow when it's already past 18:00.
        until = new Date(now);
        until.setHours(20, 0, 0, 0);
        if (now.getHours() >= 18) until.setDate(until.getDate() + 1);
      }
      f.set("pickupFrom", now.toISOString());
      f.set("pickupUntil", until.toISOString());
      if (editId) return updateListing(editId, f);
      if (!description.trim()) f.delete("description");
      if (!photos.length && fromId) f.set("fromListingId", fromId);
      if (dietary.length) f.set("dietaryTags", dietary.join(","));
      if (weight) f.set("weightKg", weight);
      if (place === "fridge" && fridgeId) f.set("fridgeId", fridgeId);
      if (handoverSpot.trim()) f.set("handoverSpot", handoverSpot.trim());
      return createListing(f);
    },
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      qc.invalidateQueries({ queryKey: ["listing", l.id] });
      nav(`/map?listing=${l.id}`, { replace: true });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (ready) m.mutate();
    else document.querySelector<HTMLElement>("[data-invalid='true']")?.scrollIntoView({ block: "center" });
  };

  return (
    <Page title={editId ? t("Edit listing") : fromId ? t("Post again") : t("Share food")}>
      {editId && fromQ.data && !editable && (
        <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {!fromQ.data.isMine
            ? t("Only the person who posted this food can edit it.")
            : fromQ.data.status === "reserved"
              ? t("Someone has reserved this food. Decline or finish that pickup before changing the listing.")
              : t("This listing can't be changed any more. Use Post again to share it once more.")}
        </p>
      )}
      <p className="mb-4 rounded-xl bg-brand-light p-3 text-sm text-brand-dark">
        {editId
          ? t("Change what you need and save. Neighbours see the update straight away.")
          : fromId
          ? t("We copied your earlier listing with fresh dates. Check it and post.")
          : t("Share in 30 seconds. Pick a category and we fill in the usual details for you.")}
      </p>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <span className={labelCls} data-invalid={!!err("photo")}>{t("Photos (at least 1, up to {n})", { n: MAX_PHOTOS })}<Req /></span>
          {shownPhotos.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {shownPhotos.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
                  <img src={src} alt={i === 0 ? t("Main photo") : t("Photo {n}", { n: i + 1 })} className="h-full w-full object-cover" />
                  {previews.length > 0 && (
                    <button
                      type="button"
                      aria-label={t("Remove photo {n}", { n: i + 1 })}
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
                  <input type="file" accept="image/*" multiple className="sr-only" aria-label={t("Add another photo")} onChange={(e) => addPhotos(e.target.files)} />
                </label>
              )}
            </div>
          ) : null}
          {(shownPhotos.length === 0 || reusePhotos.length > 0 && previews.length === 0) && (
            <label className="mt-2 block cursor-pointer">
              <div className={`flex items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-white ${shownPhotos.length ? "py-3" : "aspect-[4/3]"}`}>
                <span className="text-center text-stone-500">
                  {!shownPhotos.length && <span className="block text-4xl">📷</span>}
                  {shownPhotos.length ? t("Use new photos instead") : t("Take or choose photos")}
                </span>
              </div>
              <input type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label={t("Photo")} onChange={(e) => addPhotos(e.target.files)} />
            </label>
          )}
          <FieldError msg={err("photo")} />
        </div>

        {aiQ.data?.photoAutofill && photos.length > 0 && (
          <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-stone-200">
            <button
              type="button"
              onClick={() => autofill.mutate(photos[0])}
              disabled={autofill.isPending}
              className="min-h-[44px] w-full rounded-xl bg-accent px-4 font-bold text-stone-900 hover:brightness-105 disabled:opacity-60"
            >
              {autofill.isPending ? t("Looking at your photo…") : `✨ ${t("Fill from photo")}`}
            </button>
            {autofill.isSuccess && (
              <p role="status" className="text-sm text-brand-dark">{t("We filled in the details from your photo. Please check them, especially allergens, before posting.")}</p>
            )}
            {autofill.isError && (
              <p role="alert" className="text-sm text-red-800">{autofill.error instanceof Error ? autofill.error.message : t("We couldn't read the photo just now. Please fill in the details yourself.")}</p>
            )}
            {!autofill.isSuccess && !autofill.isError && <p className="text-xs text-stone-500">{t("Suggests the title, category, label, dietary tags and allergens from your first photo. You can change everything.")}</p>}
          </div>
        )}

        <div>
          <label className={labelCls} htmlFor="title">{t("What is it?")}<Req /></label>
          <input id="title" aria-required="true" aria-invalid={!!err("title")} data-invalid={!!err("title")} className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={TEMPLATES[category].placeholder} maxLength={80} />
          <FieldError msg={err("title")} />
        </div>

        <fieldset>
          <legend className={labelCls}>{t("Category")}<Req /></legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY) as Category[]).map((c) => (
              <button type="button" key={c} className={chipCls(category === c)} onClick={() => applyTemplate(c)} aria-pressed={category === c}>
                {CATEGORY[c].emoji} {CATEGORY[c].label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelCls} data-invalid={!!err("origin")}>{t("Label")}<Req /></legend>
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
          {origin === "homemade" && <p className="mt-1 text-xs text-stone-500">{t("Homemade food stays on the map for up to 48 hours.")}</p>}
          <FieldError msg={err("origin")} />
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="bb">{t("Best before")}<Req /></label>
            <input
              id="bb"
              type="date"
              className={inputCls}
              value={bestBefore}
              min={isoDay(new Date())}
              max={maxDate}
              onChange={(e) => setBestBefore(e.target.value)}
              aria-required="true"
            />
            <FieldError msg={err("bestBefore")} />
          </div>
          <div>
            <span className={labelCls}>{t("Portions")}<Req /></span>
            <div className="flex items-center justify-between rounded-xl border border-stone-300 bg-white">
              <button type="button" className="h-12 w-12 text-xl" onClick={() => setPortions((p) => Math.max(1, p - 1))} aria-label={t("Fewer portions")}>−</button>
              <span className="text-base font-semibold" aria-live="polite">{portions}</span>
              <button type="button" className="h-12 w-12 text-xl" onClick={() => setPortions((p) => Math.min(50, p + 1))} aria-label={t("More portions")}>+</button>
            </div>
          </div>
        </div>

        {editId ? (
          <p className="text-xs text-stone-500">{t("The pickup place stays the same. To move it, use Post again.")}</p>
        ) : (
        <fieldset>
          <legend className={labelCls}>{t("Where")}<Req /></legend>
          <div className="grid grid-cols-2 gap-2">
            {([["home", `🏠 ${t("From my home")}`], ["fridge", t("Drop at a community fridge")]] as const).map(([v, label]) => (
              <button type="button" key={v} onClick={() => setPlace(v)} aria-pressed={place === v} className={`min-h-[52px] rounded-xl px-2 text-sm font-semibold ${place === v ? "bg-brand-dark text-white" : "bg-white ring-1 ring-stone-300"}`}>
                {label}
              </button>
            ))}
          </div>
          {place === "home" ? (
            <p className="mt-1 text-xs text-stone-500">{t("Neighbours see only your area until you confirm their pickup.")}</p>
          ) : (
            <div className="mt-2">
              <label className="sr-only" htmlFor="fridge">{t("Community fridge")}</label>
              <select id="fridge" className={inputCls} value={fridgeId} onChange={(e) => setFridgeId(e.target.value)}>
                <option value="">{t("Pick a fridge")}</option>
                {fridgesQ.data?.map((fr) => (
                  <option key={fr.id} value={fr.id}>{fr.name} · {fr.address}</option>
                ))}
              </select>
              {fridgesQ.data?.length === 0 && <p className="mt-1 text-xs text-stone-500">{t("No approved fridges within 10 km of your home pin.")}</p>}
              <FieldError msg={err("fridge")} />
            </div>
          )}
        </fieldset>
        )}

        <fieldset>
          <legend className={labelCls}>{t("Pickup time")}<Req /></legend>
          <div className="flex flex-wrap gap-2">
            {editId && fromQ.data && (
              <button type="button" className={chipCls(windowIdx === -1)} onClick={() => setWindowIdx(-1)} aria-pressed={windowIdx === -1}>
                {t("Keep until {time}", { time: new Date(fromQ.data.pickupUntil).toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" }) })}
              </button>
            )}
            {WINDOWS.map((w, i) => (
              <button type="button" key={w.label} className={chipCls(windowIdx === i)} onClick={() => setWindowIdx(i)} aria-pressed={windowIdx === i}>
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelCls}>{t("Dietary")}</legend>
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

        <div>
          <label className={labelCls} htmlFor="desc">{t("Description")} <span className="font-normal text-stone-500">({t("optional")})</span></label>
          <textarea id="desc" rows={3} maxLength={500} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("What it is, ingredients, how it was stored…")} />
        </div>

        <div>
          <label className={labelCls} htmlFor="pickup-notes">{t("Pickup instructions")} <span className="font-normal text-stone-500">({t("optional")})</span></label>
          <textarea id="pickup-notes" rows={2} maxLength={300} className={inputCls} value={pickupInstructions} onChange={(e) => setPickupInstructions(e.target.value)} placeholder={t("e.g. Ring the bell for Weber, 2nd floor. Bring a bag.")} />
          <p className="mt-1 text-xs text-stone-500">{t("Only the neighbour whose pickup you confirm sees this.")}</p>
        </div>

        <details className="rounded-xl bg-white p-3 ring-1 ring-stone-200" open={!!sourceId}>
          <summary className="cursor-pointer text-sm font-semibold text-stone-700">{t("Allergens, weight and handover spot (optional)")}</summary>
          <label className={`${labelCls} mt-3`} htmlFor="weight">{t("About how much does it weigh? (kg)")}</label>
          <input id="weight" type="number" inputMode="decimal" min={0.05} max={50} step={0.1} className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={t("e.g. 0.8")} />
          <span className={`${labelCls} mt-3`}>{t("Allergens")}</span>
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
                  {allergenLabel(a)}
                </button>
              );
            })}
          </div>
          <label className={`${labelCls} mt-4`} htmlFor="spot">{t("Public handover spot")}</label>
          <input id="spot" className={inputCls} value={handoverSpot} onChange={(e) => setHandoverSpot(e.target.value)} placeholder={t("e.g. Bakery at the Hauptstraße corner")} maxLength={120} />
        </details>

        <fieldset className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <legend className="px-1 text-sm font-bold text-stone-800" data-invalid={!!err("checks")}>{t("Safety checklist")}<Req /></legend>
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
          <FieldError msg={err("checks")} />
        </fieldset>

        <ErrorNote error={m.error} />
        {tried && !ready && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">{t("Please fix these before posting:")}</p>
            <ul className="mt-1 list-disc pl-5">
              {Object.values(errors).filter(Boolean).map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}
        <button className={primaryBtn} disabled={!editable || m.isPending}>
          {editId ? (m.isPending ? t("Saving…") : t("Save changes")) : m.isPending ? t("Posting…") : t("Post to the map")}
        </button>
        <p className="text-center text-xs text-stone-500"><Req /> {t("required")}</p>
      </form>
    </Page>
  );
}
