import type { Listing } from "../api/client";
import { allergenLabel, CATEGORY, formatDay, formatDistance, formatTime, ORIGIN, timeAgo } from "../lib/format";
import { GiverRow } from "./GiverRow";

const chip = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";

/** Trust-first card: photo, best-before, origin label, giver badge and rating are always visible. */
export function ListingCard({ listing: l, compact = false, onClick }: { listing: Listing; compact?: boolean; onClick?: () => void }) {
  const cat = CATEGORY[l.category];
  return (
    <article
      className={`overflow-hidden rounded-2xl bg-white ${compact ? "flex gap-3 p-2 shadow-sm ring-1 ring-stone-200" : ""} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className={compact ? "h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100" : "aspect-[4/3] w-full overflow-hidden bg-stone-100"}>
        <img src={l.photoUrl} alt={l.title} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className={compact ? "min-w-0 flex-1 py-0.5" : "space-y-3 p-4"}>
        <div className="flex flex-wrap gap-1.5">
          <span className={`${chip} bg-accent-light text-[#7a560f]`}>Best before {formatDay(l.bestBefore)}</span>
          <span className={`${chip} bg-brand-light text-brand-dark`}>{ORIGIN[l.origin]}</span>
          {!compact && (
            <span className={`${chip} bg-stone-100 text-stone-700`}>
              {cat.emoji} {cat.label}
            </span>
          )}
        </div>
        <h2 className={`${compact ? "mt-1 truncate text-base" : "text-xl"} font-bold leading-tight`}>{l.title}</h2>
        {!compact && l.allergens.length > 0 && (
          <p className="text-sm text-stone-600">Contains: {l.allergens.map(allergenLabel).join(", ")}</p>
        )}
        <div className={compact ? "mt-1" : ""}>
          <GiverRow giver={l.giver} />
        </div>
        <p className={`text-sm text-stone-600 ${compact ? "mt-1" : ""}`}>
          {l.distanceM !== undefined && <>{formatDistance(l.distanceM)} away · </>}posted {timeAgo(l.createdAt)}
          {!compact && (
            <>
              {" "}
              · pickup {formatTime(l.pickupFrom)}–{formatTime(l.pickupUntil)} · {l.portions} {l.portions === 1 ? "portion" : "portions"}
            </>
          )}
        </p>
        {!compact && l.hasHandoverSpot && <p className="text-sm text-brand-dark">Public handover spot offered</p>}
      </div>
    </article>
  );
}
