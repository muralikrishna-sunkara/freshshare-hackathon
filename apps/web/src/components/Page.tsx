import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Page({ title, children, back = "/" }: { title: string; children: ReactNode; back?: string }) {
  return (
    <div className="min-h-full bg-stone-50">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-white px-2 py-2 shadow-sm">
        <Link to={back} className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-stone-700 hover:bg-stone-100" aria-label="Back">
          ←
        </Link>
        <h1 className="text-lg font-bold">{title}</h1>
      </header>
      <div className="mx-auto max-w-md p-4">{children}</div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";
export const labelCls = "mb-1.5 block text-sm font-semibold text-stone-700";
export const primaryBtn =
  "w-full min-h-[52px] rounded-full bg-brand-dark px-6 text-base font-bold text-white shadow disabled:opacity-50";

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
      {error instanceof Error ? error.message : "Something went wrong"}
    </p>
  );
}
