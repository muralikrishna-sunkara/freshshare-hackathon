import type { Listing } from "../api/client";
import { CATEGORY, DIETARY, formatDay, formatDistance, formatTime, ORIGIN, timeLeft } from "../lib/format";
import { Stars } from "./Stars";
import { VerifiedBadge } from "./VerifiedBadge";
import { FoodPhoto } from "./FoodPhoto";

const chip = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

function Line({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <p className="flex min-w-0 items-start gap-2 text-sm text-stone-700">
      <span aria-hidden className="w-4 shrink-0 text-center">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

/** Browse grid card: photo with category badge, trust chips, the key facts and who shares it. */
export function ListingTile({ listing: l, selected, onOpen }: { listing: Listing; selected?: boolean; onOpen: () => void }) {
  const cat = CATEGORY[l.category];
  const photos = l.photos?.length ? l.photos : [l.photoUrl];
  const where = l.fridge?.name ? `At ${l.fridge.name}` : l.areaLabel ? `Around ${l.areaLabel}` : "Address shared after confirmation";
  return (
    <article
      aria-label={l.title}
      className={`flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition hover:shadow-md ${selected ? "ring-2 ring-brand" : "ring-stone-200"}`}
    >
      <button type="button" onClick={onOpen} className="relative h-44 w-full shrink-0 bg-stone-100" aria-label={`Open ${l.title}`}>
        <FoodPhoto src={photos[0]} alt={l.title} category={l.category} />
        <span className="absolute right-2 top-2 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white shadow">
          {cat.emoji} {cat.label}
        </span>
        {photos.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{photos.length} photos</span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <span className={`${chip} bg-accent-light text-accent-dark`}>Best before {formatDay(l.bestBefore)}</span>
          <span className={`${chip} bg-brand-light text-brand-dark`}>{ORIGIN[l.origin]}</span>
        </div>
        <div>
          <h2 className="truncate text-lg font-bold leading-tight">
            <button type="button" onClick={onOpen} className="block w-full truncate text-left hover:underline">{l.title}</button>
          </h2>
          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-stone-600">{l.description || "No description added."}</p>
        </div>
        <div className="space-y-1.5">
          <Line icon="📦">
            {l.portions} {l.portions === 1 ? "portion" : "portions"}
            {l.weightKg ? ` · ~${l.weightKg} kg` : ""}
          </Line>
          <Line icon="📍">
            {where}
            {l.distanceM !== undefined && <span className="text-stone-500"> · {formatDistance(l.distanceM)}</span>}
          </Line>
          <Line icon="🕒">
            Until {formatDay(l.pickupUntil)}, {formatTime(l.pickupUntil)} <span className="text-stone-500">· {timeLeft(l.pickupUntil)}</span>
          </Line>
          <Line icon="⚠️">{l.allergens.length ? `Contains ${l.allergens.join(", ")}` : "No allergens listed"}</Line>
        </div>
        {l.dietaryTags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {l.dietaryTags.map((t) => (
              <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">{DIETARY[t]}</span>
            ))}
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-stone-100 pt-3 text-xs text-stone-600">
          <span>
            Shared by <span className="font-semibold text-stone-800">{l.giver.name}</span>
          </span>
          {l.giver.verified && <VerifiedBadge />}
          <Stars avg={l.giver.ratingAvg} count={l.giver.ratingCount} />
        </div>
      </div>
    </article>
  );
}
