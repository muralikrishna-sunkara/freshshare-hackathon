import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { adminDecide, fetchAdminPending } from "../api/client";
import { ErrorNote, Page } from "../components/Page";
import { Skeleton } from "../components/States";
import { useMe } from "../hooks/useMe";
import { formatDay, FRIDGE_KIND, ORG_TYPE } from "../lib/format";

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

/** /admin: approve fridges and organizations (site admins only). */
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
    </Page>
  );
}
