import { useEffect, type ReactNode } from "react";

/** Desktop detail panel floating over the right side of the map. */
export function SidePanel({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!open) return null;
  return (
    <aside
      role="dialog"
      aria-label={label}
      className="absolute bottom-4 right-4 top-4 z-[1050] w-[420px] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-stone-200"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow hover:bg-white"
      >
        ✕
      </button>
      {children}
    </aside>
  );
}
