import type { Listing } from "../api/client";
import { allergenLabel, CATEGORY, DIETARY, formatDay, formatDistance, formatTime, ORIGIN, timeAgo, timeLeft } from "../lib/format";
import { GiverRow } from "./GiverRow";

const chip = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="break-words text-sm text-stone-800">{children}</dd>
    </div>
  );
}

/** List view row: everything a neighbour needs to decide without opening the listing. */
export function ListingRow({ listing: l, onOpen }: { listing: Listing; onOpen: () => void }) {
  const cat = CATEGORY[l.category];
  const photos = l.photos?.length ? l.photos : [l.photoUrl];
  const where = l.fridge?.name ? `🧊 ${l.fridge.name}` : l.areaLabel ? `Around ${l.areaLabel}` : "Exact address after confirmation";
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 sm:flex-row" aria-label={l.title}>
      <button type="button" onClick={onOpen} className="relative aspect-[4/3] w-full shrink-0 bg-stone-100 sm:aspect-auto sm:w-56" aria-label={`Open ${l.title}`}>
        <img src={photos[0]} alt={l.title} loading="lazy" className="h-full w-full object-cover" />
        {photos.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{photos.length} photos</span>
        )}
      </button>
      <div className="min-w-0 flex-1 space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <span className={`${chip} bg-accent-light text-accent-dark`}>Best before {formatDay(l.bestBefore)}</span>
          <span className={`${chip} bg-brand-light text-brand-dark`}>{ORIGIN[l.origin]}</span>
          <span className={`${chip} bg-stone-100 text-stone-700`}>{cat.emoji} {cat.label}</span>
          <span className={`${chip} bg-stone-100 text-stone-700`}>⏱ {timeLeft(l.pickupUntil)}</span>
        </div>
        <div>
          <h2 className="text-lg font-bold leading-tight">
            <button type="button" onClick={onOpen} className="block w-full text-left hover:underline">{l.title}</button>
          </h2>
          {l.description && <p className="mt-1 line-clamp-2 text-sm text-stone-700">{l.description}</p>}
        </div>
        {l.dietaryTags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {l.dietaryTags.map((t) => (
              <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">{DIETARY[t]}</span>
            ))}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-4">
          <Fact label="Distance">{l.distanceM !== undefined ? `${formatDistance(l.distanceM)} away` : "Nearby"}</Fact>
          <Fact label="Pickup">{formatTime(l.pickupFrom)}–{formatTime(l.pickupUntil)}</Fact>
          <Fact label="Amount">
            {l.portions} {l.portions === 1 ? "portion" : "portions"}
            {l.weightKg ? ` · ~${l.weightKg} kg` : ""}
          </Fact>
          <Fact label="Where">{where}</Fact>
          <Fact label="Allergens">{l.allergens.length ? l.allergens.map(allergenLabel).join(", ") : "None listed"}</Fact>
          <Fact label="Handover">{l.hasHandoverSpot ? "Public spot offered" : l.fridge ? "At the fridge" : "At the giver's door"}</Fact>
          <Fact label="Posted">{timeAgo(l.createdAt)}</Fact>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <GiverRow giver={l.giver} />
          <button type="button" onClick={onOpen} className="min-h-[40px] rounded-full bg-brand-dark px-4 text-sm font-bold text-white">
            View &amp; reserve
          </button>
        </div>
      </div>
    </article>
  );
}
