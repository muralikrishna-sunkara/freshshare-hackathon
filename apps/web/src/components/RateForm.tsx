import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { rateClaim, type Claim } from "../api/client";
import { ErrorNote, inputCls, primaryBtn } from "./Page";

export function RateForm({ claim }: { claim: Claim }) {
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const other = claim.role === "receiver" ? claim.listing.giver.name : claim.receiver.name;
  const m = useMutation({
    mutationFn: () => rateClaim(claim.id, stars, note.trim() || undefined),
    onSuccess: (c) => {
      qc.setQueryData(["claim", claim.id], c);
      qc.invalidateQueries({ queryKey: ["claims"] });
    },
  });
  if (claim.myRating) {
    return (
      <p className="rounded-xl bg-brand-light p-3 text-center text-sm font-semibold text-brand-dark">
        You rated {other.split(" ")[0]} {"★".repeat(claim.myRating)}. Thanks!
      </p>
    );
  }
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <h2 className="font-bold">How was the handover with {other.split(" ")[0]}?</h2>
      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setStars(n)}
            className={`h-12 w-12 text-4xl leading-none ${n <= stars ? "text-accent" : "text-stone-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <input className={inputCls} placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      <ErrorNote error={m.error} />
      <button className={primaryBtn} disabled={!stars || m.isPending} onClick={() => m.mutate()}>
        Send rating
      </button>
    </section>
  );
}
