import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { blockUser, unblockUser } from "../api/client";
import { ErrorNote } from "./Page";

/** T2.5: block someone (their food and chats disappear for you, and yours for them). Asks inline first. */
export function BlockButton({ userId, name, blocked }: { userId: string; name: string; blocked: boolean }) {
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const done = () => {
    setAsking(false);
    qc.invalidateQueries({ queryKey: ["user", userId] });
    qc.invalidateQueries({ queryKey: ["blocks"] });
    qc.invalidateQueries({ queryKey: ["listings"] });
    qc.invalidateQueries({ queryKey: ["claims"] });
  };
  const block = useMutation({ mutationFn: () => blockUser(userId), onSuccess: done });
  const unblock = useMutation({ mutationFn: () => unblockUser(userId), onSuccess: done });
  const first = name.split(" ")[0];
  if (blocked) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-stone-700">You blocked {first}.</span>
        <button type="button" className="font-semibold text-brand-dark underline" onClick={() => unblock.mutate()} disabled={unblock.isPending}>Unblock</button>
        <ErrorNote error={unblock.error} />
      </span>
    );
  }
  if (!asking) {
    return (
      <button type="button" className="text-sm font-semibold text-stone-600 underline" onClick={() => setAsking(true)}>
        Block {first}
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl bg-stone-50 p-3 text-sm ring-1 ring-stone-200" role="group" aria-label={`Block ${first}`}>
      <p>You won't see each other's food or messages, and open pickups between you are cancelled. {first} isn't told.</p>
      <div className="flex gap-2">
        <button type="button" className="min-h-[40px] rounded-full bg-red-700 px-4 font-bold text-white" onClick={() => block.mutate()} disabled={block.isPending}>Block</button>
        <button type="button" className="min-h-[40px] rounded-full px-4 font-semibold ring-1 ring-stone-300" onClick={() => setAsking(false)}>Cancel</button>
      </div>
      <ErrorNote error={block.error} />
    </div>
  );
}
