import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchMyClaims, fetchMyListings, type Claim, type MyListing } from "../api/client";
import { timeLeft } from "../lib/format";
import { t } from "../i18n";
import { ErrorNote, Page } from "../components/Page";

const LABEL: Record<Claim["status"], string> = {
  pending: t("Waiting for confirmation"),
  confirmed: t("Confirmed"),
  collected: t("Collected"),
  cancelled: t("Cancelled"),
  lapsed: t("Hold ran out"),
  declined: t("Declined"),
};

function Row({ c }: { c: Claim }) {
  const who = c.role === "receiver" ? t("from {name}", { name: c.listing.giver.name }) : t("for {name}", { name: c.receiver.name });
  const needsMe = c.role === "giver" && c.status === "pending";
  return (
    <Link to={`/pickups/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-stone-200">
      <img src={c.listing.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c.listing.title}</p>
        <p className="text-sm text-stone-600">{who}</p>
        <p className={`text-xs font-semibold ${needsMe ? "text-[#7a560f]" : "text-stone-500"}`}>{needsMe ? t("Needs your confirmation") : LABEL[c.status]}</p>
      </div>
    </Link>
  );
}

const LISTING_STATUS: Record<string, string> = {
  available: t("On the map"),
  reserved: t("Reserved"),
  collected: t("Collected"),
  expired: t("Expired"),
};

function MyListingRow({ l }: { l: MyListing }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-stone-200">
      <img src={l.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
      <Link to={`/listings/${l.id}`} className="min-w-0 flex-1">
        <p className="truncate font-semibold">{l.title}</p>
        <p className="text-xs font-semibold text-stone-500">
          {LISTING_STATUS[l.status] ?? l.status}
          {l.status === "available" && <> · {timeLeft(l.pickupUntil)}</>}
        </p>
      </Link>
      <Link to={`/share?from=${l.id}`} className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-brand-dark ring-1 ring-stone-300">
        {t("Post again")}
      </Link>
    </div>
  );
}

export function Pickups() {
  const q = useQuery({ queryKey: ["claims"], queryFn: fetchMyClaims, refetchInterval: 10_000 });
  const mine = useQuery({ queryKey: ["my-listings"], queryFn: fetchMyListings });
  return (
    <Page title={t("My pickups")}>
      <ErrorNote error={q.error} />
      {q.isLoading && <div className="mb-4 h-20 animate-pulse rounded-2xl bg-stone-200" />}
      <h2 className="mb-2 text-sm font-bold text-stone-700">{t("Requests for my food")}</h2>
      <div className="mb-6 space-y-2">
        {q.data?.asGiver.length ? q.data.asGiver.map((c) => <Row key={c.id} c={c} />) : <p className="text-sm text-stone-500">{t("No requests yet.")}</p>}
      </div>
      <h2 className="mb-2 text-sm font-bold text-stone-700">{t("Food I'm picking up")}</h2>
      <div className="space-y-2">
        {q.data?.asReceiver.length ? q.data.asReceiver.map((c) => <Row key={c.id} c={c} />) : <p className="text-sm text-stone-500">{t("Nothing reserved yet.")} <Link to="/map" className="font-semibold text-brand-dark underline">{t("Find food on the map")}</Link>.</p>}
      </div>
      <h2 className="mb-2 mt-6 text-sm font-bold text-stone-700">{t("My listings")}</h2>
      <div className="space-y-2">
        {mine.isLoading && <div className="h-20 animate-pulse rounded-2xl bg-stone-200" />}
        {mine.data?.length
          ? mine.data.map((l) => <MyListingRow key={l.id} l={l} />)
          : !mine.isLoading && <p className="text-sm text-stone-500">{t("You haven't shared anything yet.")} <Link to="/share" className="font-semibold text-brand-dark underline">{t("Share food")}</Link>.</p>}
      </div>
    </Page>
  );
}
