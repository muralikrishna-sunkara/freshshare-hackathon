/** T2.8: walking directions to an exact point in OpenStreetMap, Google Maps or Apple Maps. Only render for places the viewer may see. */
export function Directions({ lat, lng, label = "Directions" }: { lat: number; lng: number; label?: string }) {
  const to = `${lat},${lng}`;
  const links = [
    ["OpenStreetMap", `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=%3B${lat}%2C${lng}#map=17/${lat}/${lng}`],
    ["Google Maps", `https://www.google.com/maps/dir/?api=1&destination=${to}&travelmode=walking`],
    ["Apple Maps", `https://maps.apple.com/?daddr=${to}&dirflg=w`],
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-label={label} role="group">
      <span className="font-semibold text-stone-700">🧭 {label}:</span>
      {links.map(([name, href]) => (
        <a key={name} href={href} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 font-semibold text-brand-dark ring-1 ring-stone-300 hover:bg-brand-light">
          {name}
        </a>
      ))}
    </div>
  );
}
