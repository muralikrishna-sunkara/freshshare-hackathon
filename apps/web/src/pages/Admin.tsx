import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { adminDecide, fetchAdminPending, fetchAdminReports, fetchEarlyAccessStats, fetchSuspended, resolveReport, unsuspendUser } from "../api/client";
import { ErrorNote, Page } from "../components/Page";
import { Skeleton } from "../components/States";
import { useMe } from "../hooks/useMe";
import { EARLY_ROLE, formatDay, FRIDGE_KIND, ORG_TYPE, REPORT_REASON } from "../lib/format";

function Card({ title, sub, children, actions }: { title: string; sub: string; children: ReactNode; actions: ReactNode }) {
  return (
    <li className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-xs text-stone-500">{sub}</p>
      </div>
      <div className="text-sm text-stone-700">{children}</div>
      <div className="flex gap-2">{actions}</div>
    </li>
  );
}

/** /admin: approvals, the reports queue and early-access sign-ups (site admins only). */
export function AdminPage() {
  const me = useMe();
  const qc = useQueryClient();
  const isAdmin = me.data?.role === "admin";
  const q = useQuery({ queryKey: ["admin-pending"], queryFn: fetchAdminPending, enabled: isAdmin });
  const decide = useMutation({
    mutationFn: (v: { kind: "fridges" | "organizations"; id: string; decision: "approve" | "reject" }) => adminDecide(v.kind, v.id, v.decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
      qc.invalidateQueries({ queryKey: ["fridges"] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
  if (me.isLoading) return <Page title="Admin"><Skeleton /></Page>;
  if (!isAdmin) return <Navigate to="/404" replace />;
  const btn = (kind: "fridges" | "organizations", id: string, name: string) => (
    <>
      <button className="min-h-[40px] rounded-full bg-brand-dark px-4 text-sm font-bold text-white" aria-label={`Approve ${name}`} disabled={decide.isPending} onClick={() => decide.mutate({ kind, id, decision: "approve" })}>Approve</button>
      <button className="min-h-[40px] rounded-full px-4 text-sm font-semibold ring-1 ring-stone-300" aria-label={`Reject ${name}`} disabled={decide.isPending} onClick={() => decide.mutate({ kind, id, decision: "reject" })}>Reject</button>
    </>
  );
  return (
    <Page title="Admin" wide>
      <nav aria-label="Admin sections" className="mb-4 flex flex-wrap gap-2 text-sm">
        {[["#approvals", "Approvals"], ["#reports", "Reports"], ["#early-access", "Early access"]].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-stone-200 hover:ring-brand">{label}</a>
        ))}
      </nav>
      <h2 id="approvals" className="mb-3 text-lg font-bold">Approvals</h2>
      <ErrorNote error={q.error ?? decide.error} />
      {q.isLoading && <Skeleton rows={4} />}
      {q.data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 font-bold">Pending fridges ({q.data.fridges.length})</h2>
            {q.data.fridges.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">Nothing waiting. 🎉</p> : (
              <ul className="space-y-2">
                {q.data.fridges.map((f) => (
                  <Card key={f.id} title={f.name} sub={`${FRIDGE_KIND[f.kind].label} · suggested by ${f.createdBy?.name ?? "unknown"} on ${formatDay(f.createdAt)}`} actions={btn("fridges", f.id, f.name)}>
                    <p>{f.address}</p>
                    <p>Open: {f.openingHours}</p>
                    {f.description && <p>{f.description}</p>}
                    <a className="text-brand-dark underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lng}#map=18/${f.lat}/${f.lng}`}>Check the pin</a>
                  </Card>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="mb-2 font-bold">Pending organizations ({q.data.organizations.length})</h2>
            {q.data.organizations.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">Nothing waiting. 🎉</p> : (
              <ul className="space-y-2">
                {q.data.organizations.map((o) => (
                  <Card key={o.id} title={o.name} sub={`${ORG_TYPE[o.type]} · ${o.city} · registered by ${o.createdBy.name ?? "unknown"} on ${formatDay(o.createdAt)}`} actions={btn("organizations", o.id, o.name)}>
                    <p>{o.description}</p>
                    <p>Contact: {o.contactName} · {o.email}{o.registrationNumber && ` · Reg. no. ${o.registrationNumber}`}</p>
                    {o.documents.length > 0 ? (
                      <p>Documents: {o.documents.map((d) => <a key={d.id} className="mr-2 text-brand-dark underline" target="_blank" rel="noreferrer" href={`/api/organizations/${o.id}/documents/${d.id}`}>{d.filename}</a>)}</p>
                    ) : <p className="text-stone-500">No document uploaded.</p>}
                  </Card>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      <ReportsQueue />
      <SuspendedList />
      <EarlyAccess />
    </Page>
  );
}

function ReportsQueue() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const q = useQuery({ queryKey: ["admin-reports", status], queryFn: () => fetchAdminReports(status) });
  const resolve = useMutation({
    mutationFn: (v: { id: string; action: "dismiss" | "remove_listing" | "suspend_user"; reason?: string }) => resolveReport(v.id, v.action, v.reason),
    onSuccess: () => {
      setSuspending(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-suspended"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });
  const [suspending, setSuspending] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  return (
    <section className="mt-8" aria-labelledby="reports">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="reports" className="text-lg font-bold">Reports{status === "open" && q.data ? ` (${q.data.reports.length} open)` : ""}</h2>
        <div role="group" aria-label="Report status" className="flex gap-1 text-sm">
          {(["open", "resolved"] as const).map((s) => (
            <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={`min-h-[36px] rounded-full px-3 font-semibold ${status === s ? "bg-brand-dark text-white" : "ring-1 ring-stone-300"}`}>
              {s === "open" ? "Open" : "Resolved"}
            </button>
          ))}
        </div>
      </div>
      <ErrorNote error={q.error ?? resolve.error} />
      {q.isLoading && <Skeleton rows={3} />}
      {q.data && q.data.reports.length === 0 && (
        <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">{status === "open" ? "No open reports. 🎉" : "Nothing resolved yet."}</p>
      )}
      {q.data && q.data.reports.length > 0 && (
        <ul className="grid gap-3 lg:grid-cols-2">
          {q.data.reports.map((r) => (
            <li key={r.id} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
              {r.listing && <img src={r.listing.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="font-bold">
                  <span className="mr-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">{REPORT_REASON[r.reason]}</span>
                  {r.listing ? (
                    <Link className="underline" to={`/listings/${r.listing.id}`}>{r.listing.title}</Link>
                  ) : r.reportedUser ? (
                    <Link className="underline" to={`/users/${r.reportedUser.id}`}>{r.reportedUser.name}</Link>
                  ) : "Deleted item"}
                </p>
                <p className="text-xs text-stone-500">
                  Reported by {r.reporter.name} on {formatDay(r.createdAt)}
                  {r.listing && ` · listing is ${r.listing.status}`}
                  {r.resolvedAt && ` · resolved ${formatDay(r.resolvedAt)}`}
                </p>
                {r.note && <p className="text-stone-700">“{r.note}”</p>}
                {r.status === "open" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button className="min-h-[40px] rounded-full px-4 font-semibold ring-1 ring-stone-300" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, action: "dismiss" })}>
                      Dismiss
                    </button>
                    {r.listing && ["available", "reserved"].includes(r.listing.status) && (
                      <button className="min-h-[40px] rounded-full bg-red-700 px-4 font-bold text-white" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, action: "remove_listing" })}>
                        Remove listing
                      </button>
                    )}
                    {suspending !== r.id && (
                      <button className="min-h-[40px] rounded-full px-4 font-semibold text-red-800 ring-1 ring-red-300" disabled={resolve.isPending} onClick={() => setSuspending(r.id)}>
                        Suspend {r.reportedUser ? r.reportedUser.name.split(" ")[0] : "the giver"}
                      </button>
                    )}
                  </div>
                )}
                {r.status === "open" && suspending === r.id && (
                  <form
                    className="space-y-2 pt-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      resolve.mutate({ id: r.id, action: "suspend_user", reason });
                    }}
                  >
                    <label className="block text-xs font-semibold text-stone-700">
                      Reason shown to the person
                      <input className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-stone-300" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required minLength={3} />
                    </label>
                    <div className="flex gap-2">
                      <button className="min-h-[40px] rounded-full bg-red-700 px-4 font-bold text-white" disabled={resolve.isPending || reason.trim().length < 3}>Suspend account</button>
                      <button type="button" className="min-h-[40px] rounded-full px-4 font-semibold ring-1 ring-stone-300" onClick={() => setSuspending(null)}>Keep</button>
                    </div>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** T2.5: suspended accounts, with the reason they see, and a way back. */
function SuspendedList() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-suspended"], queryFn: fetchSuspended });
  const un = useMutation({ mutationFn: unsuspendUser, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-suspended"] }) });
  if (!q.data || q.data.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby="suspended">
      <h2 id="suspended" className="mb-3 text-lg font-bold">Suspended accounts ({q.data.length})</h2>
      <ErrorNote error={un.error} />
      <ul className="grid gap-2 lg:grid-cols-2">
        {q.data.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-stone-200">
            <div className="min-w-0">
              <Link to={`/users/${u.id}`} className="font-semibold underline">{u.name}</Link>
              <p className="text-stone-600">{formatDay(u.suspendedAt)} · “{u.suspendedReason}”</p>
            </div>
            <button className="min-h-[40px] shrink-0 rounded-full px-4 font-semibold ring-1 ring-stone-300" disabled={un.isPending} onClick={() => un.mutate(u.id)}>Lift suspension</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="truncate text-stone-700">{r.label}</span>
          <span className="h-3 rounded-full bg-stone-100">
            <span className="block h-3 rounded-full bg-brand" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function EarlyAccess() {
  const q = useQuery({ queryKey: ["admin-early-access"], queryFn: fetchEarlyAccessStats });
  return (
    <section className="mt-8" aria-labelledby="early-access">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="early-access" className="text-lg font-bold">Early access{q.data ? ` (${q.data.total} sign-ups)` : ""}</h2>
        <a href="/api/admin/early-access.csv" download className="min-h-[40px] rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white">
          Download CSV
        </a>
      </div>
      <ErrorNote error={q.error} />
      {q.isLoading && <Skeleton rows={3} />}
      {q.data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <h3 className="mb-3 font-semibold">By role</h3>
            <Bars rows={q.data.byRole.map((r) => ({ label: EARLY_ROLE[r.role] ?? r.role, count: r.count }))} />
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <h3 className="mb-3 font-semibold">By source</h3>
            <Bars rows={q.data.bySource.map((r) => ({ label: r.source, count: r.count }))} />
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <h3 className="mb-3 font-semibold">Latest</h3>
            {q.data.latest.length === 0 ? <p className="text-sm text-stone-500">No sign-ups yet.</p> : (
              <ul className="divide-y divide-stone-100 text-sm">
                {q.data.latest.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 py-1.5">
                    <span className="min-w-0 truncate">{s.email}</span>
                    <span className="shrink-0 text-xs text-stone-500">{EARLY_ROLE[s.role]} · {formatDay(s.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
