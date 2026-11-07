import { useState } from "react";
import type { Category } from "../api/client";
import { CATEGORY } from "../lib/format";

/** Listing photo that falls back to a clear category tile (colour + emoji + label) if the image can't load. */
export function FoodPhoto({ src, alt, category, className = "h-full w-full object-cover" }: { src: string; alt: string; category: Category; className?: string }) {
  const [broken, setBroken] = useState(!src);
  if (broken) {
    const c = CATEGORY[category];
    return (
      <div role="img" aria-label={alt} className="flex h-full w-full flex-col items-center justify-center gap-1 text-white" style={{ background: c.color }}>
        <span className="text-4xl" aria-hidden>{c.emoji}</span>
        <span className="text-xs font-bold uppercase tracking-wide">{c.label}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setBroken(true)} />;
}
