import { useEffect, useState } from "react";
import { distanceKm } from "../lib/geo";

// Seed mapCentre (Erlangen Altstadt). The demo data lives here.
export const DEMO_CENTRE = { lat: 49.5897, lng: 11.004 };
const DEMO_AREA_KM = 30;

export type LocationSource = "device" | "demo";

/** Browser location when it is inside the demo area, otherwise the Erlangen demo centre. */
export function useLocation() {
  const [loc, setLoc] = useState<{ lat: number; lng: number; source: LocationSource }>({ ...DEMO_CENTRE, source: "demo" });
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (distanceKm(here, DEMO_CENTRE) <= DEMO_AREA_KM) setLoc({ ...here, source: "device" });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300_000 },
    );
  }, []);
  return loc;
}
