import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ApiError, fetchListing } from "../api/client";
import { ListingActions } from "../components/ListingActions";
import { ListingCard } from "../components/ListingCard";
import { Page } from "../components/Page";
import { useMe } from "../hooks/useMe";

/** Shareable listing page (/listings/:id). Same privacy as the map: approximate area only. */
export function ListingPage() {
  const { id = "" } = useParams();
  const me = useMe();
  const q = useQuery({ queryKey: ["listing", id, me.data?.id], queryFn: () => fetchListing(id) });
  return (
    <Page title="Listing">
      {q.isLoading && (
        <div className="space-y-3">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-24 animate-pulse rounded-2xl bg-stone-200" />
        </div>
      )}
      {q.isError && (
        <div role="alert" className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <p className="font-semibold">
            {q.error instanceof ApiError && q.error.status === 404 ? "This listing is gone. It may have been collected or removed." : "Couldn't load this listing."}
          </p>
          <Link to="/map" className="inline-block rounded-full bg-brand-dark px-5 py-2.5 font-bold text-white">See food nearby</Link>
        </div>
      )}
      {q.data && (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
          <ListingCard listing={q.data} />
          <ListingActions listing={q.data} />
          <div className="border-t border-stone-200 p-4 text-center">
            <Link to={`/map?listing=${q.data.id}&view=map`} className="text-sm font-semibold text-brand-dark underline">Show on the map</Link>
          </div>
        </div>
      )}
    </Page>
  );
}
