import { env } from "./env.js";
import { logger } from "./logger.js";

export interface Area {
  postcode: string | null;
  areaName: string | null;
}

const cache = new Map<string, Area>();
const EMPTY: Area = { postcode: null, areaName: null };

/**
 * Reverse-geocode a point with Photon (OpenStreetMap, free, no key) and keep only the
 * structured postcode and district/city. These two fields are the only public area label.
 * Fails soft: no network or a slow answer just means no label.
 */
export async function reverseArea(lat: number, lng: number): Promise<Area> {
  if (env.GEOCODER === "off") return EMPTY;
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const url = `${env.PHOTON_URL}/reverse?lat=${lat}&lon=${lng}&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), headers: { "User-Agent": "FreshShare (freshshare.de)" } });
    if (!res.ok) throw new Error(`photon ${res.status}`);
    const body = (await res.json()) as { features?: { properties?: Record<string, string | undefined> }[] };
    const p = body.features?.[0]?.properties ?? {};
    const area: Area = { postcode: p.postcode ?? null, areaName: p.district ?? p.locality ?? p.city ?? null };
    cache.set(key, area);
    return area;
  } catch (err) {
    logger.warn({ err: String(err) }, "reverse geocode failed");
    return EMPTY;
  }
}

export const areaLabel = (a: { postcode: string | null; areaName: string | null }) =>
  [a.postcode, a.areaName].filter(Boolean).join(" ") || null;
