import { de } from "./de";

/** T2.7: English + German. The English text is the key; a missing German entry falls back to English. */
export type Lang = "en" | "de";
const KEY = "fs-lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "de") return saved;
  } catch {
    /* storage blocked: use the browser language */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";
}

export const lang: Lang = detect();
/** Locale for dates and numbers. */
export const locale = lang === "de" ? "de-DE" : "en-GB";

if (typeof document !== "undefined") document.documentElement.lang = lang;

/** Translate an English string. `{name}` placeholders are filled from vars. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const out = (lang === "de" && de[text]) || text;
  return vars ? out.replace(/\{(\w+)\}/g, (m: string, k: string) => (k in vars ? String(vars[k]) : m)) : out;
}

/** Plural helper: t1("{n} listing", "{n} listings", n). */
export const tn = (one: string, many: string, n: number, vars?: Record<string, string | number>) => t(n === 1 ? one : many, { n, ...vars });

/** Switching reloads the page so every label, date and module constant is rebuilt in the new language. */
export function setLang(next: Lang) {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  window.location.reload();
}
