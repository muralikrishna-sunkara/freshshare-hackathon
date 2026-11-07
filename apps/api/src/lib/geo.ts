const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dp = rad(bLat - aLat);
  const dl = rad(bLng - aLng);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Deterministic PRNG so seeded jitter is stable between runs. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Move a point 100-200 m in a random direction (public, approximate location). */
export function jitter(lat: number, lng: number, rand: () => number = Math.random): { lat: number; lng: number } {
  const d = 100 + rand() * 100;
  const bearing = rand() * 2 * Math.PI;
  const dLat = (d * Math.cos(bearing)) / 111320;
  const dLng = (d * Math.sin(bearing)) / (111320 * Math.cos(rad(lat)));
  return { lat: lat + dLat, lng: lng + dLng };
}

/** Distances shown to other users are rounded so exact homes can't be triangulated. */
export const roundDistance = (m: number) => Math.max(50, Math.round(m / 50) * 50);
