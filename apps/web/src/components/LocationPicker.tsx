import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

const homeIcon = L.divIcon({
  className: "",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<div style="width:34px;height:34px;border-radius:50%;background:#d9a23c;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:16px">🏠</div>`,
});

function ClickToSet({ onChange }: { onChange: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export function LocationPicker({ value, onChange }: { value: { lat: number; lng: number }; onChange: (p: { lat: number; lng: number }) => void }) {
  return (
    <div className="h-48 overflow-hidden rounded-xl ring-1 ring-stone-300">
      <MapContainer center={[value.lat, value.lng]} zoom={14} className="h-full w-full" zoomControl={false}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickToSet onChange={onChange} />
        <Marker position={[value.lat, value.lng]} icon={homeIcon} />
      </MapContainer>
    </div>
  );
}
