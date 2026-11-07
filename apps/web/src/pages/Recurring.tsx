import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createSchedule, deleteSchedule, fetchListing, fetchSchedules, updateSchedule, type Schedule } from "../api/client";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { Skeleton } from "../components/States";
import { CATEGORY } from "../lib/format";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const dayList = (d: number[]) => (d.length === 7 ? "Every day" : ORDER.filter((x) => d.includes(x)).map((x) => DAYS[x]).join(", "));

function DayPicker({ value, onChange }: { value: number[]; onChange: (d: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
      {ORDER.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={value.includes(d)}
          onClick={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])}
          className={`min-h-[40px] min-w-[48px] rounded-full px-3 text-sm font-semibold ${value.includes(d) ? "bg-brand-dark text-white" : "ring-1 ring-stone-300"}`}
        >
          {DAYS[d]}
        </button>
      ))}
    </div>
  );
}

/** "Make it recurring" for one of your listings (?from=<listingId>). */
function NewSchedule({ listingId, onDone }: { listingId: string; onDone: () => void }) {
  const l = useQuery({ queryKey: ["listing", listingId], queryFn: () => fetchListing(listingId) });
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [time, setTime] = useState("17:00");
  const [hours, setHours] = useState(3);
  const create = useMutation({ mutationFn: () => createSchedule({ fromListingId: listingId, daysOfWeek: days, time, pickupHours: hours }), onSuccess: onDone });
  if (!l.data) return <ErrorNote error={l.error} />;
  return (
    <form
      className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div className="flex items-center gap-3">
        <img src={l.data.photoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
        <div>
          <p className="font-bold">Repeat “{l.data.title}”</p>
          <p className="text-sm text-stone-600">Same text, photos and details, posted fresh on the days you pick.</p>
        </div>
      </div>
      <div>
        <p className={labelCls}>Days</p>
        <DayPicker value={days} onChange={setDays} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Goes up at</span>
          <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label className="block">
          <span className={labelCls}>Pickup open for</span>
          <select className={inputCls} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {[1, 2, 3, 4, 6, 8, 12].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>)}
          </select>
        </label>
      </div>
      <ErrorNote error={create.error} />
      <button className={primaryBtn} disabled={days.length === 0 || create.isPending}>{create.isPending ? "Saving…" : "Make it recurring"}</button>
    </form>
  );
}

function Row({ s }: { s: Schedule }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["schedules"] });
  const upd = useMutation({ mutationFn: (b: Parameters<typeof updateSchedule>[1]) => updateSchedule(s.id, b), onSuccess: refresh });
  const del = useMutation({ mutationFn: () => deleteSchedule(s.id), onSuccess: refresh });
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState(s.daysOfWeek);
  const [time, setTime] = useState(s.time);
  return (
    <li className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex items-start gap-3">
        {s.photoUrl && <img src={s.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">{CATEGORY[s.category].emoji} {s.title}</p>
          <p className="text-stone-700">{dayList(s.daysOfWeek)} at {s.time} · pickup open {s.pickupHours} h · {s.portions} portions</p>
          <p className="text-stone-500">{s.active ? (s.nextRun ? `Next: ${s.nextRun}` : "") : "Paused"}{s.lastPostedOn ? ` · last posted ${s.lastPostedOn}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${s.active ? "bg-brand-light text-brand-dark" : "bg-stone-100 text-stone-600"}`}>{s.active ? "Active" : "Paused"}</span>
      </div>
      {editing && (
        <div className="space-y-3">
          <DayPicker value={days} onChange={setDays} />
          <label className="block max-w-[10rem]">
            <span className={labelCls}>Time</span>
            <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
      )}
      <ErrorNote error={upd.error} />
      <div className="flex flex-wrap gap-2 text-sm">
        {editing ? (
          <button className="min-h-[40px] rounded-full bg-brand-dark px-4 font-bold text-white" disabled={days.length === 0 || upd.isPending} onClick={() => upd.mutate({ daysOfWeek: days, time }, { onSuccess: () => setEditing(false) })}>Save</button>
        ) : (
          <button className="min-h-[40px] rounded-full px-4 font-semibold ring-1 ring-stone-300" onClick={() => setEditing(true)}>Edit days and time</button>
        )}
        <button className="min-h-[40px] rounded-full px-4 font-semibold ring-1 ring-stone-300" disabled={upd.isPending} onClick={() => upd.mutate({ active: !s.active })}>{s.active ? "Pause" : "Resume"}</button>
        <button className="min-h-[40px] rounded-full px-4 font-semibold text-red-800 ring-1 ring-red-200" disabled={del.isPending} onClick={() => del.mutate()}>Delete</button>
      </div>
    </li>
  );
}

/** /me/recurring (T2.4): listings that post themselves on chosen weekdays. */
export function RecurringPage() {
  const [params, setParams] = useSearchParams();
  const from = params.get("from");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["schedules"], queryFn: fetchSchedules });
  return (
    <Page title="Recurring listings">
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          For bakeries, cafés and anyone with regular surplus: a recurring listing posts itself on the days you choose, with a fresh pickup window and best-before date. Homemade food can't repeat automatically.
        </p>
        {from && (
          <NewSchedule
            listingId={from}
            onDone={() => {
              setParams({});
              qc.invalidateQueries({ queryKey: ["schedules"] });
            }}
          />
        )}
        {q.isLoading && <Skeleton rows={2} />}
        <ErrorNote error={q.error} />
        {q.data && q.data.length === 0 && !from && (
          <p className="rounded-2xl bg-white p-4 text-sm text-stone-600 ring-1 ring-stone-200">
            No recurring listings yet. Open one of your listings and choose <strong>Repeat on a schedule</strong>. <Link className="font-semibold text-brand-dark underline" to="/share">Share food</Link>
          </p>
        )}
        {q.data && q.data.length > 0 && <ul className="space-y-3">{q.data.map((s) => <Row key={s.id} s={s} />)}</ul>}
      </div>
    </Page>
  );
}
