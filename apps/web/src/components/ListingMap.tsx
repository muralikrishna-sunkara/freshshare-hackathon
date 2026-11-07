import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { Fridge, Listing } from "../api/client";
import { CATEGORY } from "../lib/format";

const pinIcon = (color: string, emoji: string) =>
  L.divIcon({
    className: "",
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    html: `<div style="position:relative;width:36px;height:44px">
      <svg viewBox="0 0 36 44" width="36" height="44" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">
        <path d="M18 43C18 43 33 27 33 17A15 15 0 0 0 3 17C3 27 18 43 18 43Z" fill="${color}" stroke="#fff" stroke-width="2.5"/>
      </svg>
      <span style="position:absolute;top:6px;left:0;width:36px;text-align:center;font-size:16px;line-height:20px">${emoji}</span>
    </div>`,
  });

const fridgeIcon = L.divIcon({
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  html: `<div style="width:32px;height:32px;border-radius:9px;background:#fff;border:2.5px solid #3e6b35;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 1px 3px rgba(0,0,0,.3)">🧊</div>`,
});

function Recentre({ lat, lng, radius }: { lat: number; lng: number; radius: number }) {
  const map = useMap();
  useEffect(() => {
    const dLat = radius / 111320;
    const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180));
    map.invalidateSize();
    map.fitBounds(
      [
        [lat - dLat, lng - dLng],
        [lat + dLat, lng + dLng],
      ],
      { padding: [8, 8], animate: false },
    );
  }, [map, lat, lng, radius]);
  return null;
}

function FocusOn({ focus }: { focus?: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], 16, { animate: false });
  }, [map, focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function ListingMap(props: {
  centre: { lat: number; lng: number };
  radius: number;
  listings: Listing[];
  fridges: Fridge[];
  onSelect: (l: Listing) => void;
  focus?: { lat: number; lng: number };
}) {
  const icons = useMemo(
    () => Object.fromEntries(Object.entries(CATEGORY).map(([k, c]) => [k, pinIcon(c.color, c.emoji)])) as Record<string, L.DivIcon>,
    [],
  );
  const { centre, radius } = props;
  return (
    <MapContainer center={[centre.lat, centre.lng]} zoom={14} className="h-full w-full" zoomControl={false} attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recentre lat={centre.lat} lng={centre.lng} radius={radius} />
      <FocusOn focus={props.focus} />
      <Circle center={[centre.lat, centre.lng]} radius={radius} pathOptions={{ color: "#6b9f5e", weight: 2, fillOpacity: 0.06, dashArray: "6 6" }} />
      {props.fridges.map((f) => (
        <Marker key={f.id} position={[f.lat, f.lng]} icon={fridgeIcon} title={f.name} />
      ))}
      {props.listings.map((l) => (
        <Marker
          key={l.id}
          position={[l.publicLat, l.publicLng]}
          icon={icons[l.category]}
          title={l.title}
          eventHandlers={{ click: () => props.onSelect(l) }}
        />
      ))}
    </MapContainer>
  );
}
