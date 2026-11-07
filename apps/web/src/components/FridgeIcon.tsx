/**
 * A recognisable upright fridge (two doors, handles) instead of the 🧊 emoji, which reads as a box.
 * `fridgeSvg` is the same drawing as a string for Leaflet map pins.
 */
export const fridgeSvg = (size = 20, color = "#1f4337") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M5 9.5h14"/><path d="M8.5 5v2.5"/><path d="M8.5 12.5v4"/><path d="M7 22v0.5M17 22v0.5"/></svg>`;

export function FridgeIcon({ className = "h-5 w-5", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 ${className}`} aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2.5" />
      <path d="M5 9.5h14" />
      <path d="M8.5 5v2.5" />
      <path d="M8.5 12.5v4" />
    </svg>
  );
}
