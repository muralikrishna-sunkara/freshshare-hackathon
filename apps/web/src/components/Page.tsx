import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

/** Standard page: app navigation on top, page title, centred content. `wide` for two-column pages. */
export function Page({ title, children, wide = false }: { title: string; children: ReactNode; back?: string; wide?: boolean }) {
  return (
    <div className="flex min-h-full flex-col bg-stone-50">
      <AppHeader />
      <main className={`mx-auto w-full flex-1 px-4 py-6 lg:px-6 lg:py-10 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
        <h1 className="mb-6 text-2xl font-bold lg:text-3xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";
export const labelCls = "mb-1.5 block text-sm font-semibold text-stone-700";
export const primaryBtn =
  "w-full min-h-[48px] rounded-full bg-brand-dark px-6 text-base font-bold text-white shadow hover:brightness-110 disabled:opacity-50";

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
      {error instanceof Error ? error.message : "Something went wrong"}
    </p>
  );
}
