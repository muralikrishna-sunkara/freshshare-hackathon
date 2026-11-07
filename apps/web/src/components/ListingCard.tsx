import type { Listing } from "../api/client";
import { useState } from "react";
import { allergenLabel, CATEGORY, DIETARY, formatDay, formatDistance, formatTime, ORIGIN, timeAgo, timeLeft } from "../lib/format";
import { GiverRow } from "./GiverRow";
import { FridgeIcon } from "./FridgeIcon";
import { t, tn } from "../i18n";
import { FoodPhoto } from "./FoodPhoto";

const chip = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";

/** Trust-first card: photo, best-before, origin label, giver badge and rating are always visible. */
export function ListingCard({ listing: l, compact = false, onClick }: { listing: Listing; compact?: boolean; onClick?: () => void }) {
  const cat = CATEGORY[l.category];
  const photos = l.photos?.length ? l.photos : [l.photoUrl];
  const [shown, setShown] = useState(0);
  return (
    <article
      className={`overflow-hidden rounded-2xl bg-white ${compact ? "flex gap-3 p-2 shadow-sm ring-1 ring-stone-200" : ""} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className={compact ? "h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100" : "aspect-[4/3] w-full overflow-hidden bg-stone-100"}>
        <FoodPhoto key={compact ? photos[0] : photos[shown] ?? photos[0]} src={compact ? photos[0] : photos[shown] ?? photos[0]} alt={l.title} category={l.category} />
      </div>
      {!compact && photos.length > 1 && (
        <div className="flex gap-2 px-4 pt-3" aria-label={t("More photos")}>
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShown(i);
              }}
              aria-label={t("Photo {i} of {n}", { i: i + 1, n: photos.length })}
              aria-pressed={shown === i}
              className={`h-14 w-14 overflow-hidden rounded-lg ring-2 ${shown === i ? "ring-brand" : "ring-transparent"}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <div className={compact ? "min-w-0 flex-1 py-0.5" : "space-y-3 p-4"}>
        <div className="flex flex-wrap gap-1.5">
          <span className={`${chip} bg-accent-light text-[#7a560f]`}>{t("Best before {date}", { date: formatDay(l.bestBefore) })}</span>
          <span className={`${chip} bg-brand-light text-brand-dark`}>{ORIGIN[l.origin]}</span>
          {!compact && (
            <span className={`${chip} bg-stone-100 text-stone-700`}>
              {cat.emoji} {cat.label}
            </span>
          )}
        </div>
        <h2 className={`${compact ? "mt-1 truncate text-base" : "text-xl"} font-bold leading-tight`}>{l.title}</h2>
        {l.dietaryTags?.length > 0 && (
          <div className={`flex flex-wrap gap-1 ${compact ? "mt-1" : ""}`}>
            {l.dietaryTags.map((tag) => (
              <span key={tag} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">{DIETARY[tag]}</span>
            ))}
          </div>
        )}
        {!compact && l.description && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{t("Description")}</p>
            <p className="whitespace-pre-line text-sm text-stone-700">{l.description}</p>
          </div>
        )}
        {!compact && l.pickupInstructions && (
          <div className="rounded-xl bg-brand-light p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">{t("Pickup instructions")}</p>
            <p className="whitespace-pre-line text-sm text-stone-800">{l.pickupInstructions}</p>
          </div>
        )}
        {!compact && l.allergens.length > 0 && (
          <p className="text-sm text-stone-600">{t("Contains: {list}", { list: l.allergens.map(allergenLabel).join(", ") })}</p>
        )}
        <div className={compact ? "mt-1" : ""}>
          <GiverRow giver={l.giver} />
        </div>
        <p className={`text-sm text-stone-600 ${compact ? "mt-1" : ""}`}>
          {l.distanceM !== undefined && <>{t("{d} away", { d: formatDistance(l.distanceM) })} · </>}
          {compact ? timeLeft(l.pickupUntil) : <>{t("posted {ago}", { ago: timeAgo(l.createdAt) })}</>}
          {!compact && (
            <>
              {" "}
              · {t("pickup {from}–{until}", { from: formatTime(l.pickupFrom), until: formatTime(l.pickupUntil) })} · {tn("{n} portion", "{n} portions", l.portions)}
            </>
          )}
        </p>
        {l.fridge?.name && <p className="flex items-center gap-1 text-sm font-semibold text-brand-dark"><FridgeIcon className="h-4 w-4" /> {t("At {place}", { place: l.fridge.name })}</p>}
        {!compact && !l.fridge && l.areaLabel && <p className="text-sm text-stone-600">📍 {t("Around {area} (exact address after confirmation)", { area: l.areaLabel })}</p>}
        {!compact && l.weightKg && <p className="text-sm text-stone-600">{t("About {kg} kg", { kg: l.weightKg })}</p>}
        {!compact && l.hasHandoverSpot && <p className="text-sm text-brand-dark">{t("Public handover spot offered")}</p>}
      </div>
    </article>
  );
}
