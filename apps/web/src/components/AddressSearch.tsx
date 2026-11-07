import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces, type Place } from "../lib/photon";

/**
 * Type-ahead address / place search (Photon). Arrow keys + Enter pick a result; Escape closes.
 * Results are biased towards `near` (the map centre or the person's home).
 */
export function AddressSearch(props: {
  label: string;
  placeholder?: string;
  near?: { lat: number; lng: number };
  onPick: (p: Place) => void;
  defaultValue?: string;
  className?: string;
  hideLabel?: boolean;
}) {
  const [q, setQ] = useState(props.defaultValue ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [failed, setFailed] = useState(false);
  const listId = useId();
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q.trim(), props.near, ctl.signal)
        .then((r) => {
          setResults(r);
          setFailed(false);
          setOpen(true);
          setActive(-1);
        })
        .catch((e) => {
          if ((e as Error).name !== "AbortError") setFailed(true);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (p: Place) => {
    picked.current = true;
    setQ(p.sub ? `${p.label}, ${p.sub}` : p.label);
    setOpen(false);
    props.onPick(p);
  };

  return (
    <div className={`relative ${props.className ?? ""}`}>
      <label className={props.hideLabel ? "sr-only" : "mb-1 block text-sm font-semibold text-stone-700"} htmlFor={`${listId}-input`}>
        {props.label}
      </label>
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className="w-full min-h-[44px] rounded-xl bg-white px-3 py-2 ring-1 ring-stone-300 focus:outline-none focus:ring-2 focus:ring-brand"
        placeholder={props.placeholder ?? "Street, place or postcode"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && open && results.length) {
            e.preventDefault();
            pick(results[Math.max(0, active)]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-[1100] mt-1 max-h-72 w-full overflow-auto rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-stone-200">
          {results.map((r, i) => (
            <li
              key={`${r.lat},${r.lng},${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-brand-light" : "hover:bg-stone-50"}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
            >
              <span className="font-semibold">{r.label}</span>
              {r.sub && <span className="block text-xs text-stone-500">{r.sub}</span>}
            </li>
          ))}
        </ul>
      )}
      {failed && <p className="mt-1 text-xs text-stone-500">Address search isn't reachable right now. Tap the map instead.</p>}
    </div>
  );
}
