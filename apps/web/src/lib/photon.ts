/** Address and place search with Photon (OpenStreetMap data, no key). Used for type-ahead (T2.8). */
export interface Place {
  label: string;
  sub: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; postcode?: string; city?: string; district?: string; locality?: string; country?: string };
}

export async function searchPlaces(q: string, near?: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  const p = new URLSearchParams({ q, limit: "5", lang: "en" });
  if (near) {
    p.set("lat", String(near.lat));
    p.set("lon", String(near.lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${p}`, { signal });
  if (!res.ok) return [];
  const body = (await res.json()) as { features: PhotonFeature[] };
  return body.features.map((f) => {
    const pr = f.properties;
    const street = pr.street ? `${pr.street}${pr.housenumber ? ` ${pr.housenumber}` : ""}` : "";
    const label = pr.name && pr.name !== pr.street ? pr.name : street || pr.city || "Unnamed place";
    const sub = [pr.name && street ? street : "", [pr.postcode, pr.district ?? pr.locality].filter(Boolean).join(" "), pr.city !== label ? pr.city : ""].filter(Boolean).join(", ");
    return { label, sub, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
  });
}
