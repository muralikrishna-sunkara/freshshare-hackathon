import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { report, type ReportReason } from "../api/client";
import { useMe } from "../hooks/useMe";
import { REPORT_REASON } from "../lib/format";
import { ErrorNote, inputCls, labelCls } from "./Page";

const LISTING_REASONS: ReportReason[] = ["unsafe_food", "prohibited_item", "spam", "no_show", "other"];
const USER_REASONS: ReportReason[] = ["harassment", "no_show", "spam", "unsafe_food", "other"];

/** Report a listing or a person. Goes to the admin queue. */
export function ReportButton({ listingId, userId, label = "Report" }: { listingId?: string; userId?: string; label?: string }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const m = useMutation({ mutationFn: () => report({ listingId, userId, reason: reason as ReportReason, note: note.trim() || undefined }) });
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  if (!me.data) return null;
  const reasons = listingId ? LISTING_REASONS : USER_REASONS;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-stone-500 underline hover:text-red-700">
        {label}
      </button>
      <dialog ref={ref} onCancel={() => setOpen(false)} aria-labelledby="report-title" className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-2xl backdrop:bg-black/50">
        <div className="space-y-4 p-5">
          <h2 id="report-title" className="text-lg font-bold">{listingId ? "Report this listing" : "Report this person"}</h2>
          {m.isSuccess ? (
            <>
              <p role="status" className="rounded-xl bg-brand-light p-3 text-sm text-brand-dark">{m.data.message}</p>
              <button type="button" className="w-full min-h-[44px] rounded-full bg-brand-dark font-bold text-white" onClick={() => setOpen(false)}>Close</button>
            </>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (reason) m.mutate();
              }}
            >
              <fieldset>
                <legend className={labelCls}>What's wrong?</legend>
                <div className="space-y-1">
                  {reasons.map((r) => (
                    <label key={r} className="flex min-h-[40px] items-center gap-2">
                      <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} />
                      {REPORT_REASON[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className={labelCls} htmlFor="report-note">Anything else? <span className="font-normal text-stone-500">(optional)</span></label>
                <textarea id="report-note" rows={2} maxLength={500} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <ErrorNote error={m.error} />
              <div className="flex gap-2">
                <button type="button" className="min-h-[44px] flex-1 rounded-full font-semibold ring-1 ring-stone-300" onClick={() => setOpen(false)}>Cancel</button>
                <button className="min-h-[44px] flex-1 rounded-full bg-red-700 font-bold text-white disabled:opacity-50" disabled={!reason || m.isPending}>
                  {m.isPending ? "Sending…" : "Send report"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
