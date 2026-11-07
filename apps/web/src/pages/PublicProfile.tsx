import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ApiError, fetchPublicProfile } from "../api/client";
import { Page } from "../components/Page";
import { ReportButton } from "../components/ReportButton";
import { Stars } from "../components/Stars";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { useMe } from "../hooks/useMe";
import { formatDay } from "../lib/format";
import { UserImpactPanel } from "../components/ImpactPanel";

/** Public profile, open to visitors: name, bio, rating and reviews. Never email or location. */
export function PublicProfile() {
  const { id = "" } = useParams();
  const me = useMe();
  const q = useQuery({ queryKey: ["user", id], queryFn: () => fetchPublicProfile(id) });
  if (q.isLoading)
    return (
      <Page title="Profile">
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-40 animate-pulse rounded-2xl bg-stone-200" />
        </div>
      </Page>
    );
  if (q.isError || !q.data)
    return (
      <Page title="Profile">
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {q.error instanceof ApiError && q.error.status === 404 ? "This person doesn't exist." : "Couldn't load this profile. Please try again."}
        </p>
      </Page>
    );
  const u = q.data;
  return (
    <Page title={u.name}>
      <div className="space-y-5">
        <section className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white">{u.name.charAt(0)}</span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {u.verified && <VerifiedBadge />}
              <Stars avg={u.ratingAvg} count={u.ratingCount} />
            </div>
            <p className="text-sm text-stone-600">Member since {new Date(u.memberSince).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
            {me.data?.id === u.id ? (
              <Link to="/profile" className="text-sm font-semibold text-brand-dark underline">Edit your profile</Link>
            ) : (
              <ReportButton userId={u.id} label="Report this person" />
            )}
          </div>
        </section>
        {u.bio && <p className="rounded-2xl bg-white p-4 text-stone-700 ring-1 ring-stone-200">{u.bio}</p>}
        <section className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Listed", u.stats.shared],
            ["Given", u.stats.given],
            ["Received", u.stats.received],
          ].map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
              <p className="text-2xl font-extrabold text-brand-dark">{n}</p>
              <p className="text-xs text-stone-600">{label}</p>
            </div>
          ))}
        </section>
        <UserImpactPanel userId={u.id} own={me.data?.id === u.id} />
        <section>
          <h2 className="mb-2 text-sm font-bold text-stone-700">Reviews</h2>
          {u.reviews.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">No reviews yet. They appear after a completed pickup.</p>
          ) : (
            <ul className="space-y-2">
              {u.reviews.map((r) => (
                <li key={r.id} className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link to={`/users/${r.from.id}`} className="font-semibold hover:underline">{r.from.name}</Link>
                    <span className="text-accent" aria-label={`${r.stars} out of 5 stars`}>{"★".repeat(r.stars)}<span className="text-stone-300">{"★".repeat(5 - r.stars)}</span></span>
                  </div>
                  {r.note && <p className="mt-1 text-sm text-stone-700">{r.note}</p>}
                  <p className="mt-1 text-xs text-stone-500">{formatDay(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}
