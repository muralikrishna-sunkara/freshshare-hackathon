import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchAlerts, saveAlerts, type Category } from "../api/client";
import { CATEGORY } from "../lib/format";
import { currentSubscription, disablePush, enablePush, pushSupported, sendTestPush } from "../lib/push";
import { ErrorNote } from "./Page";

const RADII = [500, 1000, 2000, 5000];
const km = (m: number) => (m < 1000 ? `${m} m` : `${m / 1000} km`);

/** T2.2: alert area (around home), categories, and push notifications on this device. */
export function AlertSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["alerts"], queryFn: fetchAlerts });
  const save = useMutation({ mutationFn: saveAlerts, onSuccess: (a) => qc.setQueryData(["alerts"], a) });
  const [device, setDevice] = useState<"unknown" | "on" | "off">("unknown");
  const [pushError, setPushError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    currentSubscription().then((s) => setDevice(s ? "on" : "off")).catch(() => setDevice("off"));
  }, []);

  if (!q.data) return null;
  const a = save.isPending && save.variables ? { ...q.data, ...save.variables } : q.data;
  const set = (patch: Partial<{ enabled: boolean; radiusM: number; categories: Category[] }>) =>
    save.mutate({ enabled: a.enabled, radiusM: a.radiusM, categories: a.categories, ...patch });
  const toggleCat = (c: Category) => set({ categories: a.categories.includes(c) ? a.categories.filter((x) => x !== c) : [...a.categories, c] });

  const pushToggle = async () => {
    setBusy(true);
    setPushError(null);
    setNote("");
    try {
      if (device === "on") {
        await disablePush();
        setDevice("off");
      } else {
        await enablePush();
        setDevice("on");
      }
    } catch (e) {
      setPushError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-stone-200" aria-labelledby="alerts-h">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="alerts-h" className="font-semibold">Food alerts near home</h2>
          <p className="text-stone-600">Get told when new food is posted in your area. At most one alert every 20 minutes.</p>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input type="checkbox" className="peer sr-only" checked={a.enabled} onChange={(e) => set({ enabled: e.target.checked })} aria-label="Food alerts near home" />
          <span className="h-7 w-12 rounded-full bg-stone-300 transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand" />
          <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </label>
      </div>
      {a.enabled && (
        <>
          <fieldset>
            <legend className="mb-1 font-semibold text-stone-700">Distance</legend>
            <div className="flex flex-wrap gap-2">
              {RADII.map((r) => (
                <button key={r} type="button" aria-pressed={a.radiusM === r} onClick={() => set({ radiusM: r })} className={`min-h-[36px] rounded-full px-3 font-semibold ${a.radiusM === r ? "bg-brand-dark text-white" : "ring-1 ring-stone-300"}`}>
                  {km(r)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 font-semibold text-stone-700">Only these kinds of food <span className="font-normal text-stone-500">(none ticked = everything)</span></legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY) as Category[]).map((c) => (
                <button key={c} type="button" aria-pressed={a.categories.includes(c)} onClick={() => toggleCat(c)} className={`min-h-[36px] rounded-full px-3 ${a.categories.includes(c) ? "bg-brand-light font-semibold text-brand-dark ring-1 ring-brand" : "ring-1 ring-stone-300"}`}>
                  {CATEGORY[c].emoji} {CATEGORY[c].label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <ErrorNote error={save.error} />
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
        <p className="mr-auto text-stone-600">
          {device === "on" ? "Push notifications are on for this device." : "Alerts always show under 🔔. Turn on push to get them even when FreshShare is closed."}
        </p>
        {pushSupported() && (
          <button type="button" onClick={pushToggle} disabled={busy || device === "unknown"} className="min-h-[40px] rounded-full px-4 font-semibold ring-1 ring-stone-300">
            {device === "on" ? "Turn off on this device" : "Turn on push on this device"}
          </button>
        )}
        {device === "on" && (
          <button type="button" className="font-semibold text-brand-dark underline" onClick={() => sendTestPush().then((r) => setNote(r.sent ? "Test sent" : "Nothing sent"), (e) => setNote((e as Error).message))}>
            Send a test
          </button>
        )}
        {note && <span role="status" className="text-stone-600">{note}</span>}
      </div>
      {pushError && <p role="alert" className="rounded-xl bg-red-50 p-2 text-red-800">{pushError}</p>}
    </section>
  );
}
