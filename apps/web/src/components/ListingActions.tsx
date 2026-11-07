import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchListing, reserveListing, type Listing } from "../api/client";
import { useMe } from "../hooks/useMe";
import { ErrorNote, primaryBtn } from "./Page";

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
  });
  const d = detail.data;
  const firstName = listing.giver.name.split(" ")[0];

  if (d?.isMine) {
    return (
      <div className="px-4 pb-6">
        <Link to="/pickups" className="block rounded-xl bg-stone-100 p-3 text-center text-sm font-semibold">
          This is your listing · see requests in My pickups
        </Link>
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
  const available = (d?.status ?? listing.status) === "available";
  return (
    <div className="space-y-2 px-4 pb-6">
      <ErrorNote error={reserve.error} />
      {!available ? (
        <p className="rounded-xl bg-stone-100 p-3 text-center font-semibold text-stone-600">Reserved</p>
      ) : me.data ? (
        <button className={primaryBtn} onClick={() => reserve.mutate()} disabled={reserve.isPending}>
          {reserve.isPending ? "Reserving…" : "Reserve"}
        </button>
      ) : (
        <Link to={`/signin?next=${encodeURIComponent(`/?listing=${listing.id}`)}`} className={`${primaryBtn} flex items-center justify-center`}>
          Sign in to reserve
        </Link>
      )}
      <p className="text-center text-sm text-stone-600">
        You'll get the exact address once {firstName} confirms. Meet in a public place if you prefer.
      </p>
    </div>
  );
}
