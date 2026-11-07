import { useQuery } from "@tanstack/react-query";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { fetchNearby } from "../api/client";

// Erlangen Altstadt (seed mapCentre). Block 2 adds browser geolocation.
const CENTRE: [number, number] = [49.5897, 11.004];
const RADIUS = 2000;

export function MapHome() {
  const { data: listings = [], isLoading, error } = useQuery({
    queryKey: ["listings", CENTRE, RADIUS],
    queryFn: () => fetchNearby(CENTRE[0], CENTRE[1], RADIUS),
  });

  return (
    <div className="relative h-full w-full">
      <header className="absolute inset-x-0 top-0 z-[1000] flex items-center justify-between bg-white/95 px-4 py-3 shadow-sm">
        <h1 className="text-lg font-bold text-brand-dark">FreshShare</h1>
        <span className="text-sm text-stone-600">
          {isLoading ? "Loading…" : error ? "Could not load listings" : `${listings.length} within 2 km`}
        </span>
      </header>
      <MapContainer center={CENTRE} zoom={14} className="h-full w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle center={CENTRE} radius={RADIUS} pathOptions={{ color: "#6b9f5e", weight: 1, fillOpacity: 0.05 }} />
        {listings.map((l) => (
          <CircleMarker
            key={l.id}
            center={[l.publicLat, l.publicLng]}
            radius={10}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#e89344", fillOpacity: 1 }}
          >
            <Popup>
              <img src={l.photoUrl} alt="" className="mb-2 h-28 w-48 rounded object-cover" />
              <strong>{l.title}</strong>
              <br />
              {l.giver.name} {l.giver.verified ? "✓ Verified" : ""} · ★ {l.giver.ratingAvg}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
