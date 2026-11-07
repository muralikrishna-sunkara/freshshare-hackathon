import { useState } from "react";

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
}

const KEY = "freshshare.savedSearches";

function load(): SavedSearch[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.query === "string" && typeof x.name === "string") : [];
  } catch {
    return [];
  }
}

/** Saved browse filters, kept in this browser only (no account data). */
export function useSavedSearches() {
  const [items, setItems] = useState<SavedSearch[]>(load);
  const persist = (next: SavedSearch[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: keep for this visit only */
    }
  };
  return {
    items,
    save: (name: string, query: string) => {
      if (items.some((s) => s.query === query)) return;
      persist([{ id: String(Date.now()), name, query }, ...items].slice(0, 10));
    },
    remove: (id: string) => persist(items.filter((s) => s.id !== id)),
  };
}
