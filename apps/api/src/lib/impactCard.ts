import sharp from "sharp";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const fmt = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export interface CardInput {
  headline: string; // "Anna K. shared" / "Demo Food Bank rescued"
  name: string;
  meals: number;
  kg: number;
  co2Kg: number;
  waterL: number;
  footnote: string; // "Member since Oct 2026"
}

/** 1200x630 PNG share card (Open Graph size) in the Basil & Honey colours. Text is drawn with DejaVu Sans. */
export async function renderImpactCard(c: CardInput): Promise<Buffer> {
  const stat = (x: number, value: string, label: string) => `
    <g transform="translate(${x},330)">
      <rect width="250" height="170" rx="24" fill="#ffffff" fill-opacity="0.1"/>
      <text x="24" y="78" font-size="56" font-weight="700" fill="#ffffff">${esc(value)}</text>
      <text x="24" y="126" font-size="24" fill="#e3ede8">${esc(label)}</text>
    </g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" font-family="DejaVu Sans, Arial, sans-serif">
  <rect width="1200" height="630" fill="#2e5e4e"/>
  <circle cx="1120" cy="70" r="210" fill="#1f4337"/>
  <circle cx="1160" cy="640" r="100" fill="#d9a23c" opacity="0.9"/>
  <text x="70" y="92" font-size="40" font-weight="700" fill="#ffffff">Fresh<tspan fill="#d9a23c">Share</tspan></text>
  <text x="70" y="190" font-size="30" fill="#e3ede8">${esc(c.headline)}</text>
  <text x="70" y="262" font-size="60" font-weight="700" fill="#ffffff">${esc(clip(c.name, 28))}</text>
  ${stat(70, fmt(c.meals), "meals saved")}
  ${stat(340, `${fmt(Math.round(c.kg))} kg`, "food rescued")}
  ${stat(610, `${fmt(Math.round(c.co2Kg))} kg`, "CO₂e avoided")}
  ${stat(880, `${fmt(Math.round(c.waterL))} L`, "water saved")}
  <text x="70" y="572" font-size="24" fill="#e3ede8">${esc(c.footnote)} · estimates · freshshare.de</text>
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
