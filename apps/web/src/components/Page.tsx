import { ApiError } from "../api/client";
import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";

/** Standard page: app navigation on top, page title, centred content. `wide` for two-column pages. */
export function Page({ title, children, wide = false }: { title: string; children: ReactNode; back?: string; wide?: boolean }) {
  return (
    <div className="flex min-h-full flex-col bg-stone-50">
      <AppHeader />
      <main className={`mx-auto w-full flex-1 px-4 py-6 lg:px-6 lg:py-10 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
        <h1 className="mb-6 text-2xl font-bold lg:text-3xl">{title}</h1>
        {children}
      </main>
      <Footer />
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
      {plainError(error)}
    </p>
  );
}

/** A sentence a person can act on, never a status code or a stack trace. */
export function plainError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status >= 500) return "Something went wrong on our side. Please try again in a moment.";
    // The API sends friendly messages; fall back only when a proxy answered with a bare status text.
    if (error.code !== "error" && error.message) return error.message;
    if (error.status === 401) return "Please sign in to do that.";
    if (error.status === 403) return "You don't have access to this.";
    if (error.status === 429) return "That was a lot of tries. Please wait a minute and try again.";
    return "Something went wrong. Please try again.";
  }
  if (error instanceof TypeError) return "We couldn't reach FreshShare. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
