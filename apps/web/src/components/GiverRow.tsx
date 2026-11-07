import { Link } from "react-router-dom";
import type { Giver } from "../api/client";
import { Stars } from "./Stars";
import { VerifiedBadge } from "./VerifiedBadge";

export function GiverRow({ giver }: { giver: Giver }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-700" aria-hidden>
        {giver.name.charAt(0)}
      </span>
      <Link to={`/users/${giver.id}`} className="text-sm font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
        {giver.name}
      </Link>
      {giver.verified && <VerifiedBadge />}
      <Stars avg={giver.ratingAvg} count={giver.ratingCount} />
    </div>
  );
}
