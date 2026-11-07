import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, fetchListing, joinWaitlist, leaveWaitlist, reserveListing, type Listing } from "../api/client";
import { useMe } from "../hooks/useMe";
import { ErrorNote, primaryBtn } from "./Page";
import { ReportButton } from "./ReportButton";

/** Reserve button and status under the card in the bottom sheet. */
export function ListingActions({ listing }: { listing: Listing }) {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["listing", listing.id, me.data?.id], queryFn: () => fetchListing(listing.id) });
  const reserve = useMutation({
    mutationFn: () => reserveListing(listing.id),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["claims"] });
      nav(`/pickups/${c.id}`);
    },
    onError: () => qc.invalidateQueries({ queryKey: ["listing", listing.id] }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["listing", listing.id] });
  const join = useMutation({ mutationFn: () => joinWaitlist(listing.id), onSuccess: refresh });
  const leave = useMutation({ mutationFn: () => leaveWaitlist(listing.id), onSuccess: refresh });
  const d = detail.data;
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const firstName = listing.giver.name.split(" ")[0];

  if (d?.isMine) {
    return (
      <div className="space-y-2 px-4 pb-6">
        <Link to="/pickups" className="block rounded-xl bg-stone-100 p-3 text-center text-sm font-semibold">
          This is your listing · see requests in My pickups
        </Link>
        <Link to={`/share?from=${listing.id}`} className="block rounded-xl p-3 text-center text-sm font-semibold text-brand-dark ring-1 ring-stone-300">
          Post again
        </Link>
        {listing.origin !== "homemade" && (
          <Link to={`/me/recurring?from=${listing.id}`} className="block rounded-xl p-3 text-center text-sm font-semibold text-brand-dark ring-1 ring-stone-300">
            🔁 Repeat on a schedule
          </Link>
        )}
      </div>
    );
  }
  if (d?.myClaim) {
    return (
      <div className="px-4 pb-6">
        <Link to={`/pickups/${d.myClaim.id}`} className={`${primaryBtn} flex items-center justify-center`}>
          View your pickup ({d.myClaim.status})
        </Link>
      </div>
    );
  }
  const lostRace = reserve.error instanceof ApiError && (reserve.error.code === "not_available" || reserve.error.code === "held_for_waitlist");
  const heldForOther = !!d?.heldUntil && !d.heldForMe;
  const available = (d?.status ?? listing.status) === "available" && !heldForOther && !lostRace;
  const position = d?.waitlist.myPosition;
  return (
    <div className="space-y-2 px-4 pb-6">
      <ErrorNote error={reserve.error ?? join.error} />
      {d?.heldForMe && d.heldUntil && (
        <p className="rounded-xl bg-accent/15 p-3 text-center text-sm font-semibold text-stone-800" data-testid="held-for-me">
          You were first on the waitlist: it's held for you until {time(d.heldUntil)}.
        </p>
      )}
      {available ? (
        me.data ? (
          <button className={primaryBtn} onClick={() => reserve.mutate()} disabled={reserve.isPending}>
            {reserve.isPending ? "Reserving…" : "Reserve"}
          </button>
        ) : (
          <Link to={`/signin?next=${encodeURIComponent(`/map?listing=${listing.id}`)}`} className={`${primaryBtn} flex items-center justify-center`}>
            Sign in to reserve
          </Link>
        )
      ) : (
        <div className="space-y-2 rounded-xl bg-stone-100 p-3 text-center" data-testid="waitlist-box">
          <p className="font-semibold text-stone-700">
            {heldForOther ? `Offered to the next person on the waitlist until ${time(d!.heldUntil!)}` : "Reserved by someone else"}
          </p>
          {position ? (
            <>
              <p className="text-sm text-stone-700">You're <strong>#{position}</strong> on the waitlist. If the pickup falls through, you get it first for 30 minutes.</p>
              <button type="button" onClick={() => leave.mutate()} disabled={leave.isPending} className="text-sm font-semibold text-stone-600 underline">
                Leave waitlist
              </button>
            </>
          ) : me.data ? (
            <button type="button" onClick={() => { reserve.reset(); join.mutate(); }} disabled={join.isPending} className={primaryBtn}>
              {join.isPending ? "Joining…" : `Join waitlist${d?.waitlist.count ? ` (${d.waitlist.count} waiting)` : ""}`}
            </button>
          ) : (
            <Link to={`/signin?next=${encodeURIComponent(`/listings/${listing.id}`)}`} className="text-sm font-semibold text-brand-dark underline">Sign in to join the waitlist</Link>
          )}
        </div>
      )}
      <p className="text-center text-sm text-stone-600">
        You'll get the exact address once {firstName} confirms. Meet in a public place if you prefer.
      </p>
      <div className="flex items-center justify-center gap-4 text-sm">
        <Link to={`/listings/${listing.id}`} className="font-semibold text-brand-dark underline">Open full page</Link>
        <ReportButton listingId={listing.id} label="Report listing" />
      </div>
    </div>
  );
}
