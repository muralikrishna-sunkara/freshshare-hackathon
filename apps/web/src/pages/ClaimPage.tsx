import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import { useParams } from "react-router-dom";
import { claimAction, fetchClaim, type Claim, type ClaimStatus } from "../api/client";
import { Chat } from "../components/Chat";
import { GiverRow } from "../components/GiverRow";
import { ListingCard } from "../components/ListingCard";
import { RateForm } from "../components/RateForm";
import { ErrorNote, Page, primaryBtn } from "../components/Page";
import { EnterPickupCode, ShowPickupCode } from "../components/PickupCode";
import { Directions } from "../components/Directions";
import { formatTime } from "../lib/format";

const exactIcon = L.divIcon({
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<div style="width:30px;height:30px;border-radius:50%;background:#1f4337;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
});

function statusLine(c: Claim): { text: string; tone: string } {
  const giver = c.listing.giver.name.split(" ")[0];
  const s: Record<ClaimStatus, { text: string; tone: string }> = {
    pending:
      c.role === "receiver"
        ? { text: `Waiting for ${giver} to confirm · held until ${formatTime(c.holdUntil)}`, tone: "bg-accent-light text-[#7a560f]" }
        : { text: `${c.receiver.name} wants this · confirm before ${formatTime(c.holdUntil)}`, tone: "bg-accent-light text-[#7a560f]" },
    confirmed: { text: "Confirmed · see the pickup location below", tone: "bg-brand-light text-brand-dark" },
    collected: { text: "Collected · thank you for saving food!", tone: "bg-brand-light text-brand-dark" },
    cancelled: { text: "Cancelled", tone: "bg-stone-100 text-stone-600" },
    lapsed: { text: "The 30-minute hold ran out", tone: "bg-stone-100 text-stone-600" },
    declined: { text: c.role === "receiver" ? `${giver} couldn't make this one work` : "You declined this request", tone: "bg-stone-100 text-stone-600" },
  };
  return s[c.status];
}

export function ClaimPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["claim", id], queryFn: () => fetchClaim(id), refetchInterval: 5000 });
  const act = useMutation({
    mutationFn: (a: "confirm" | "collected" | "cancel" | "decline") => claimAction(id, a),
    onSuccess: (c) => {
      qc.setQueryData(["claim", id], c);
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["impact"] });
    },
  });

  if (q.isLoading) return <Page title="Pickup"><p className="text-stone-500">Loading…</p></Page>;
  if (!q.data) return <Page title="Pickup"><ErrorNote error={q.error} /></Page>;
  const c = q.data;
  const l = c.listing;
  const st = statusLine(c);
  const active = c.status === "pending" || c.status === "confirmed";

  return (
    <Page title="Pickup" wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4">
        <p className={`rounded-xl p-3 text-sm font-semibold ${st.tone}`} role="status">{st.text}</p>
        {c.status === "collected" && <RateForm claim={c} />}
        {c.status === "confirmed" && c.role === "receiver" && <ShowPickupCode claim={c} />}
        {c.status === "confirmed" && c.role === "giver" && (
          <EnterPickupCode claim={c} onCollected={(n) => { qc.setQueryData(["claim", id], n); qc.invalidateQueries({ queryKey: ["listings"] }); }} />
        )}

        <div className="overflow-hidden rounded-2xl ring-1 ring-stone-200">
          <ListingCard listing={l} compact />
        </div>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <h2 className="mb-2 text-sm font-bold text-stone-700">{c.role === "receiver" ? "Giver" : "Receiver"}</h2>
          <GiverRow giver={c.role === "receiver" ? l.giver : c.receiver} />
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <h2 className="mb-2 text-sm font-bold text-stone-700">Pickup location</h2>
          {l.lat !== undefined && l.lng !== undefined ? (
            <div className="space-y-2">
              {l.handoverSpot && <p className="font-semibold">Meet at: {l.handoverSpot}</p>}
              <div className="h-40 overflow-hidden rounded-xl">
                <MapContainer center={[l.lat, l.lng]} zoom={16} className="h-full w-full" zoomControl={false}>
                  <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[l.lat, l.lng]} icon={exactIcon} />
                </MapContainer>
              </div>
              <Directions lat={l.lat} lng={l.lng} />
              <p className="text-sm text-stone-600">Pickup window {formatTime(l.pickupFrom)}–{formatTime(l.pickupUntil)}</p>
            </div>
          ) : (
            <p className="text-sm text-stone-600">
              You'll see the exact address once {l.giver.name.split(" ")[0]} confirms. Meet in a public place if you prefer.
            </p>
          )}
        </section>

        <ErrorNote error={act.error} />
        {c.role === "giver" && c.status === "pending" && (
          <>
            <button className={primaryBtn} onClick={() => act.mutate("confirm")} disabled={act.isPending}>
              Confirm pickup
            </button>
            <button
              className="w-full min-h-[48px] rounded-full text-sm font-semibold text-stone-700 ring-1 ring-stone-300"
              onClick={() => act.mutate("decline")}
              disabled={act.isPending}
            >
              Decline
            </button>
          </>
        )}
        {c.status === "confirmed" && (
          <button className="w-full min-h-[48px] rounded-full text-sm font-semibold text-brand-dark ring-1 ring-stone-300" onClick={() => act.mutate("collected")} disabled={act.isPending}>
            {c.role === "giver" ? "Mark collected without a code" : "Mark collected"}
          </button>
        )}
        {active && !(c.role === "giver" && c.status === "pending") && (
          <button className="w-full min-h-[48px] rounded-full text-sm font-semibold text-stone-600 ring-1 ring-stone-300" onClick={() => act.mutate("cancel")} disabled={act.isPending}>
            Cancel pickup
          </button>
        )}
      </div>
      <div className="lg:sticky lg:top-6">
        <Chat claim={c} />
      </div>
      </div>
    </Page>
  );
}
