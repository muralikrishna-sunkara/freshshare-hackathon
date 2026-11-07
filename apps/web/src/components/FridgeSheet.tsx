import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { checkInFridge, type Fridge, type FridgeState } from "../api/client";
import { useMe } from "../hooks/useMe";
import { formatDistance, timeAgo } from "../lib/format";
import { ErrorNote } from "./Page";

const STATE: Record<FridgeState, { label: string; tone: string; emoji: string }> = {
  stocked: { label: "Stocked", tone: "bg-brand-light text-brand-dark", emoji: "✅" },
  empty: { label: "Empty", tone: "bg-stone-100 text-stone-700", emoji: "🫙" },
  needs_cleaning: { label: "Needs cleaning", tone: "bg-accent-light text-[#7a560f]", emoji: "🧽" },
};

export function FridgeSheet({ fridge: f }: { fridge: Fridge }) {
  const me = useMe();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (s: FridgeState) => checkInFridge(f.id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fridges"] }),
  });
  return (
    <div className="space-y-3 pb-6">
      {f.photoUrl && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
          <img src={f.photoUrl} alt={f.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="space-y-2 px-4">
        <span className="inline-flex rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand-dark">🧊 Community fridge</span>
        <h2 className="text-xl font-bold">{f.name}</h2>
        <p className="text-sm text-stone-600">{f.address} · {formatDistance(f.distanceM)} away</p>
        <p className="text-sm text-stone-600">Open: {f.openingHours}</p>
        {f.lastCheckIn ? (
          <p className={`rounded-xl p-3 text-sm font-semibold ${STATE[f.lastCheckIn.state].tone}`}>
            Last checked {timeAgo(f.lastCheckIn.at)}: {STATE[f.lastCheckIn.state].label.toLowerCase()}
          </p>
        ) : (
          <p className="rounded-xl bg-stone-100 p-3 text-sm">No check-ins yet.</p>
        )}
        <h3 className="pt-2 text-sm font-bold text-stone-700">I just checked it</h3>
        {me.data ? (
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(STATE) as FridgeState[]).map((s) => (
              <button
                key={s}
                onClick={() => m.mutate(s)}
                disabled={m.isPending}
                className="min-h-[56px] rounded-xl bg-white px-1 text-sm font-semibold ring-1 ring-stone-300 disabled:opacity-50"
              >
                <span className="block text-lg">{STATE[s].emoji}</span>
                {STATE[s].label}
              </button>
            ))}
          </div>
        ) : (
          <Link to="/signin" className="block text-sm font-semibold text-brand-dark underline">Sign in to check in</Link>
        )}
        {m.isSuccess && <p className="text-sm text-brand-dark">Thanks! Neighbours will see this.</p>}
        <ErrorNote error={m.error} />
      </div>
    </div>
  );
}
