import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Fridge, Listing } from "../api/client";
import { CATEGORY } from "../lib/format";
import { fridgeSvg } from "./FridgeIcon";

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
  html: `<div style="width:32px;height:32px;border-radius:9px;background:#fff;border:2.5px solid #1f4337;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.3)">${fridgeSvg(20)}</div>`,
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

const clusterIcon = (n: number) =>
  L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="width:44px;height:44px;border-radius:50%;background:#2e5e4e;color:#fff;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font:700 15px/1 system-ui,sans-serif">${n}</div>`,
  });

/** Pins closer than this many pixels merge into a numbered cluster (T2.8); tapping one zooms in. */
const CLUSTER_PX = 46;
const NO_CLUSTER_ZOOM = 17;

function ClusteredListings({ listings, icons, onSelect }: { listings: Listing[]; icons: Record<string, L.DivIcon>; onSelect: (l: Listing) => void }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const groups = useMemo(() => {
    const out: { p: L.Point; items: Listing[] }[] = [];
    for (const l of listings) {
      const p = map.project([l.publicLat, l.publicLng], zoom);
      const g = zoom >= NO_CLUSTER_ZOOM ? undefined : out.find((o) => o.p.distanceTo(p) < CLUSTER_PX);
      if (g) g.items.push(l);
      else out.push({ p, items: [l] });
    }
    return out;
  }, [listings, zoom, map]);
  return (
    <>
      {groups.map((g) => {
        if (g.items.length === 1) {
          const l = g.items[0];
          return <Marker key={l.id} position={[l.publicLat, l.publicLng]} icon={icons[l.category]} title={l.title} eventHandlers={{ click: () => onSelect(l) }} />;
        }
        const lat = g.items.reduce((n, l) => n + l.publicLat, 0) / g.items.length;
        const lng = g.items.reduce((n, l) => n + l.publicLng, 0) / g.items.length;
        const bounds = L.latLngBounds(g.items.map((l) => [l.publicLat, l.publicLng] as [number, number]));
        return (
          <Marker
            key={g.items.map((l) => l.id).join(",")}
            position={[lat, lng]}
            icon={clusterIcon(g.items.length)}
            title={`${g.items.length} listings here: zoom in`}
            eventHandlers={{ click: () => map.fitBounds(bounds.pad(0.4), { maxZoom: NO_CLUSTER_ZOOM, animate: true }) }}
          />
        );
      })}
    </>
  );
}

/** Reports the map centre once the person has panned well away from the searched area. */
function MoveWatcher({ centre, radius, onMoved }: { centre: { lat: number; lng: number }; radius: number; onMoved: (c: { lat: number; lng: number } | null) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMoved(map.distance(c, [centre.lat, centre.lng]) > radius * 0.35 ? { lat: c.lat, lng: c.lng } : null);
    },
  });
  return null;
}

export function ListingMap(props: {
  centre: { lat: number; lng: number };
  radius: number;
  listings: Listing[];
  fridges: Fridge[];
  onSelect: (l: Listing) => void;
  onSelectFridge: (f: Fridge) => void;
  focus?: { lat: number; lng: number };
  /** "Search this area": called with the map centre when the person taps the button. */
  onSearchArea?: (c: { lat: number; lng: number }) => void;
}) {
  const [moved, setMoved] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => setMoved(null), [props.centre.lat, props.centre.lng]);
  const icons = useMemo(
    () => Object.fromEntries(Object.entries(CATEGORY).map(([k, c]) => [k, pinIcon(c.color, c.emoji)])) as Record<string, L.DivIcon>,
    [],
  );
  const { centre, radius } = props;
  return (
    <div className="relative h-full w-full">
    {moved && props.onSearchArea && (
      <button
        type="button"
        onClick={() => props.onSearchArea!(moved)}
        className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-dark shadow-lg ring-1 ring-stone-200"
      >
        🔍 Search this area
      </button>
    )}
    <MapContainer center={[centre.lat, centre.lng]} zoom={14} className="h-full w-full" zoomControl={false} attributionControl>
      <MoveWatcher centre={centre} radius={radius} onMoved={setMoved} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recentre lat={centre.lat} lng={centre.lng} radius={radius} />
      <FocusOn focus={props.focus} />
      <Circle center={[centre.lat, centre.lng]} radius={radius} pathOptions={{ color: "#2e5e4e", weight: 2, fillOpacity: 0.06, dashArray: "6 6" }} />
      {props.fridges.map((f) => (
        <Marker
          key={f.id}
          position={[f.lat, f.lng]}
          icon={fridgeIcon}
          title={f.name}
          eventHandlers={{ click: () => props.onSelectFridge(f) }}
        />
      ))}
      <ClusteredListings listings={props.listings} icons={icons} onSelect={props.onSelect} />
    </MapContainer>
    </div>
  );
}
