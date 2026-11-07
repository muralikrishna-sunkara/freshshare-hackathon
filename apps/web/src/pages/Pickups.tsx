import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchMyClaims, type Claim } from "../api/client";
import { ErrorNote, Page } from "../components/Page";

const LABEL: Record<Claim["status"], string> = {
  pending: "Waiting for confirmation",
  confirmed: "Confirmed",
  collected: "Collected",
  cancelled: "Cancelled",
  lapsed: "Hold ran out",
};

function Row({ c }: { c: Claim }) {
  const who = c.role === "receiver" ? `from ${c.listing.giver.name}` : `for ${c.receiver.name}`;
  const needsMe = c.role === "giver" && c.status === "pending";
  return (
    <Link to={`/pickups/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-stone-200">
      <img src={c.listing.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c.listing.title}</p>
        <p className="text-sm text-stone-600">{who}</p>
        <p className={`text-xs font-semibold ${needsMe ? "text-[#7a560f]" : "text-stone-500"}`}>{needsMe ? "Needs your confirmation" : LABEL[c.status]}</p>
      </div>
    </Link>
  );
}

export function Pickups() {
  const q = useQuery({ queryKey: ["claims"], queryFn: fetchMyClaims, refetchInterval: 10_000 });
  return (
    <Page title="My pickups">
      <ErrorNote error={q.error} />
      <h2 className="mb-2 text-sm font-bold text-stone-700">Requests for my food</h2>
      <div className="mb-6 space-y-2">
        {q.data?.asGiver.length ? q.data.asGiver.map((c) => <Row key={c.id} c={c} />) : <p className="text-sm text-stone-500">No requests yet.</p>}
      </div>
      <h2 className="mb-2 text-sm font-bold text-stone-700">Food I'm picking up</h2>
      <div className="space-y-2">
        {q.data?.asReceiver.length ? q.data.asReceiver.map((c) => <Row key={c.id} c={c} />) : <p className="text-sm text-stone-500">Nothing reserved yet. Find food on the map.</p>}
      </div>
    </Page>
  );
}
