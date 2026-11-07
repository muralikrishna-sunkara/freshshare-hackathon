import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Skeleton({ rows = 3, className = "h-20" }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${className} animate-pulse rounded-2xl bg-stone-200`} />
      ))}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: { to: string; label: string } }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-stone-200">
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 text-sm text-stone-600">{children}</p>}
      {action && (
        <Link to={action.to} className="mt-3 inline-block rounded-full bg-brand-dark px-5 py-2.5 text-sm font-bold text-white">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Success({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-xl bg-brand-light p-3 text-sm text-brand-dark">
      {children}
    </p>
  );
}

export function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-sm text-red-700">{msg}</p> : null;
}
