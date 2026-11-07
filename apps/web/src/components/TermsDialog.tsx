import { useEffect, useRef } from "react";
import { TermsText } from "./TermsText";

/** Modal with the full terms. Only "I Accept Terms & Conditions" ticks the sign-up checkbox; Decline leaves it unticked. */
export function TermsDialog({ open, onAccept, onDecline }: { open: boolean; onAccept: () => void; onDecline: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onDecline();
      }}
      aria-labelledby="terms-title"
      className="w-[calc(100%-2rem)] max-w-2xl rounded-2xl p-0 shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex max-h-[85vh] flex-col">
        <h2 id="terms-title" className="border-b border-stone-200 px-5 py-4 text-lg font-bold">Terms & Conditions</h2>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <TermsText headingLevel={3} />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-stone-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onDecline} className="min-h-[44px] rounded-full px-5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50">
            Decline
          </button>
          <button type="button" onClick={onAccept} className="min-h-[44px] rounded-full bg-brand-dark px-5 text-sm font-bold text-white hover:brightness-110">
            I Accept Terms & Conditions
          </button>
        </div>
      </div>
    </dialog>
  );
}
