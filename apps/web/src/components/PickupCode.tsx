import { useMutation, useQueryClient } from "@tanstack/react-query";
import qrcode from "qrcode-generator";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { verifyPickupCode, type Claim } from "../api/client";
import { ErrorNote, inputCls, primaryBtn } from "./Page";

/**
 * T2.6 handover check. The receiver shows a QR code (a link to this pickup with the code) and the 6 digits;
 * the giver scans it with their phone camera, which opens this page with the code filled in, or types it.
 */
export function ShowPickupCode({ claim }: { claim: Claim }) {
  const src = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(`${window.location.origin}/pickups/${claim.id}?code=${claim.pickupCode}`);
    qr.make();
    return qr.createDataURL(6, 2);
  }, [claim.id, claim.pickupCode]);
  if (!claim.pickupCode) return null;
  return (
    <section className="rounded-2xl bg-white p-4 text-center ring-1 ring-stone-200" aria-labelledby="code-h">
      <h2 id="code-h" className="font-bold">Your pickup code</h2>
      <p className="mt-1 text-sm text-stone-600">Show this at the handover. {claim.listing.giver.name.split(" ")[0]} scans it or types the code to finish the pickup.</p>
      <img src={src} alt={`QR code for pickup code ${claim.pickupCode}`} className="mx-auto my-3 h-48 w-48 [image-rendering:pixelated]" />
      <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-brand-dark" data-testid="pickup-code">{claim.pickupCode}</p>
    </section>
  );
}

export function EnterPickupCode({ claim, onCollected }: { claim: Claim; onCollected: (c: Claim) => void }) {
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => (params.get("code") ?? "").replace(/\D/g, "").slice(0, 6));
  const qc = useQueryClient();
  const verify = useMutation({
    mutationFn: () => verifyPickupCode(claim.id, code),
    onSuccess: (c) => {
      onCollected(c);
      qc.invalidateQueries({ queryKey: ["claims"] });
    },
  });
  return (
    <form
      className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200"
      onSubmit={(e) => {
        e.preventDefault();
        verify.mutate();
      }}
    >
      <h2 className="font-bold">Check the pickup code</h2>
      <p className="text-sm text-stone-600">Scan {claim.receiver.name.split(" ")[0]}'s QR code with your phone camera, or type the 6 digits from their pickup page.</p>
      <label className="block">
        <span className="sr-only">Pickup code</span>
        <input
          className={`${inputCls} text-center font-mono text-2xl tracking-[0.3em]`}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          aria-label="Pickup code"
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </label>
      <ErrorNote error={verify.error} />
      <button className={primaryBtn} disabled={code.length !== 6 || verify.isPending}>
        {verify.isPending ? "Checking…" : "Confirm handover"}
      </button>
    </form>
  );
}
