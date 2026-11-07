import type { Giver } from "../api/client";
import { Stars } from "./Stars";
import { VerifiedBadge } from "./VerifiedBadge";

export function GiverRow({ giver }: { giver: Giver }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-700" aria-hidden>
        {giver.name.charAt(0)}
      </span>
      <span className="text-sm font-medium">{giver.name}</span>
      {giver.verified && <VerifiedBadge />}
      <Stars avg={giver.ratingAvg} count={giver.ratingCount} />
    </div>
  );
}
