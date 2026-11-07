import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchOrgImpact, fetchUserImpact, type ImpactMonth, type ImpactTotals4 } from "../api/client";
import { CATEGORY } from "../lib/format";
import { Skeleton } from "./States";

const n = (x: number) => x.toLocaleString("en-GB", { maximumFractionDigits: 1 });

function Tiles({ t }: { t: ImpactTotals4 }) {
  const tiles: [string, string, string][] = [
    ["🍽️", n(t.meals), "meals saved"],
    ["⚖️", `${n(t.kg)} kg`, "food rescued"],
    ["🌍", `${n(t.co2Kg)} kg`, "CO₂e avoided"],
    ["💧", `${n(t.waterL)} L`, "water saved"],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map(([icon, v, label]) => (
        <div key={label} className="rounded-xl bg-brand-light p-3">
          <p className="text-xl font-extrabold text-brand-dark"><span aria-hidden className="mr-1 text-base">{icon}</span>{v}</p>
          <p className="text-xs text-stone-600">{label}</p>
        </div>
      ))}
    </div>
  );
}

function Months({ months }: { months: ImpactMonth[] }) {
  const max = Math.max(1, ...months.map((m) => m.meals));
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-stone-700">Meals per month</p>
      <div className="flex h-28 items-end gap-1.5" role="img" aria-label={months.map((m) => `${m.label}: ${m.meals} meals`).join(", ")}>
        {months.map((m) => (
          <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-semibold text-stone-600">{m.meals || ""}</span>
            <div className="w-full rounded-t bg-brand" style={{ height: `${(m.meals / max) * 80}%`, minHeight: m.meals ? 3 : 0 }} />
            <span className="truncate text-[10px] text-stone-500">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card preview with Share (Web Share API with the image, or copy link) and Download. */
function ShareCard({ src, title, fileName }: { src: string; title: string; fileName: string }) {
  const [note, setNote] = useState("");
  const absolute = new URL(src, window.location.origin).toString();
  const share = async () => {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${title} on FreshShare` });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title, url: absolute });
        return;
      }
      await navigator.clipboard.writeText(absolute);
      setNote("Link copied");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("Couldn't share. Use Download instead.");
    }
  };
  return (
    <div className="space-y-2">
      <img src={src} alt={`${title}: impact card`} className="w-full rounded-xl ring-1 ring-stone-200" loading="lazy" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={share} className="min-h-[40px] rounded-full bg-brand-dark px-4 text-sm font-bold text-white">Share impact card</button>
        <a href={src} download={fileName} className="flex min-h-[40px] items-center rounded-full px-4 text-sm font-semibold ring-1 ring-stone-300">Download image</a>
        {note && <span role="status" className="text-sm text-stone-600">{note}</span>}
      </div>
    </div>
  );
}

const method = (f: { kgPerPortion: number; co2ePerKg: number; waterLitresPerKg: number }) =>
  `Estimates from collected pickups: entered weight or ${f.kgPerPortion} kg per portion, ${f.co2ePerKg} kg CO₂e and ${f.waterLitresPerKg} L water per kg (FAO).`;

export function UserImpactPanel({ userId, own }: { userId: string; own: boolean }) {
  const q = useQuery({ queryKey: ["impact-user", userId], queryFn: () => fetchUserImpact(userId) });
  if (q.isLoading) return <Skeleton rows={2} />;
  if (!q.data) return null;
  const d = q.data;
  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200" aria-labelledby="impact-h">
      <h2 id="impact-h" className="font-bold">{own ? "Your impact" : "Impact"}</h2>
      <Tiles t={d.total} />
      <p className="text-sm text-stone-600">
        Gave away <strong>{n(d.given.meals)} meals</strong> ({n(d.given.kg)} kg) and rescued <strong>{n(d.received.meals)}</strong> ({n(d.received.kg)} kg).{" "}
        {d.listingsShared} listings shared{d.fridgeCheckIns ? `, ${d.fridgeCheckIns} fridge check-ins` : ""}.
      </p>
      <Months months={d.monthly} />
      {own && d.total.pickups > 0 && <ShareCard src={`/api/impact/users/${userId}/card.png`} title={`${d.user.name}'s impact`} fileName="freshshare-impact.png" />}
      <p className="text-xs text-stone-500">{method(d.factors)}</p>
    </section>
  );
}

export function OrgImpactPanel({ orgId, member }: { orgId: string; member: boolean }) {
  const q = useQuery({ queryKey: ["impact-org", orgId], queryFn: () => fetchOrgImpact(orgId) });
  if (q.isLoading) return <Skeleton rows={2} />;
  if (!q.data) return null;
  const d = q.data;
  const maxCat = Math.max(1, ...d.categories.map((c) => c.meals));
  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200" aria-labelledby="org-impact-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="org-impact-h" className="font-bold">Impact</h2>
        {member && (
          <a href={`/api/impact/organizations/${orgId}/report.pdf`} className="flex min-h-[40px] items-center rounded-full bg-brand-dark px-4 text-sm font-bold text-white">
            📄 Download impact report (PDF)
          </a>
        )}
      </div>
      <Tiles t={d.total} />
      <p className="text-sm text-stone-600">
        {d.total.pickups} pickups in {d.pickupRuns} pickup runs from {d.giversHelped} givers. Last 12 months: {n(d.last12Months.meals)} meals, {n(d.last12Months.kg)} kg.
      </p>
      <Months months={d.monthly} />
      {d.categories.length > 0 && (
        <ul className="space-y-1.5">
          {d.categories.map((c) => (
            <li key={c.category} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-sm">
              <span>{CATEGORY[c.category]?.emoji} {CATEGORY[c.category]?.label ?? c.category}</span>
              <span className="h-2.5 rounded-full bg-stone-100"><span className="block h-2.5 rounded-full bg-accent" style={{ width: `${(c.meals / maxCat) * 100}%` }} /></span>
              <span className="text-right font-semibold tabular-nums">{c.meals}</span>
            </li>
          ))}
        </ul>
      )}
      {member && d.total.pickups > 0 && <ShareCard src={`/api/impact/organizations/${orgId}/card.png`} title={`${d.organization.name}'s impact`} fileName="freshshare-org-impact.png" />}
      <p className="text-xs text-stone-500">{method(d.factors)}</p>
    </section>
  );
}
