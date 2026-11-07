import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { fetchMessages, sendMessage, type Claim, type Message } from "../api/client";
import { useMe } from "../hooks/useMe";
import { formatTime } from "../lib/format";

const QUICK = ["On my way", "Running 5 min late", "Can we meet somewhere public?"];

/** Pickup chat. New messages arrive live over Server-Sent Events; polling every 10 s is the fallback. */
export function Chat({ claim }: { claim: Claim }) {
  const me = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const key = ["messages", claim.id];
  const [live, setLive] = useState(false);
  const q = useQuery({ queryKey: key, queryFn: () => fetchMessages(claim.id), refetchInterval: live ? 10_000 : 3000 });
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource(`/api/claims/${claim.id}/stream`, { withCredentials: true });
    es.addEventListener("ready", () => setLive(true));
    es.addEventListener("message", (ev) => {
      const m = JSON.parse((ev as MessageEvent).data) as Message;
      qc.setQueryData<Message[]>(["messages", claim.id], (xs = []) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]));
    });
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [claim.id, qc]);
  const send = useMutation({
    mutationFn: (body: string) => sendMessage(claim.id, body),
    onSuccess: (m) => {
      qc.setQueryData<Message[]>(key, (xs = []) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]));
      setText("");
    },
  });
  const messages = q.data ?? [];
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  const open = claim.status !== "cancelled" && claim.status !== "lapsed" && claim.status !== "declined";
  const other = claim.role === "receiver" ? claim.listing.giver.name : claim.receiver.name;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) send.mutate(text.trim());
  };

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200" aria-label="Chat">
      <h2 className="mb-2 text-sm font-bold text-stone-700">Chat with {other.split(" ")[0]}</h2>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-stone-500">No messages yet. Agree a time here.</p>}
        {messages.map((m) => {
          const mine = m.senderId === me.data?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand-dark text-white" : "bg-stone-100 text-stone-900"}`}>
                {m.body}
                <span className={`ml-2 text-[10px] ${mine ? "text-white/70" : "text-stone-500"}`}>{formatTime(m.createdAt)}</span>
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {open && (
        <>
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {QUICK.map((qr) => (
              <button key={qr} onClick={() => send.mutate(qr)} className="min-h-[40px] shrink-0 rounded-full bg-brand-light px-3 text-sm font-semibold text-brand-dark">
                {qr}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="mt-2 flex gap-2">
            <input
              aria-label="Message"
              className="min-h-[44px] min-w-0 flex-1 rounded-full border border-stone-300 px-4 text-base outline-none focus:border-brand"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message"
              maxLength={500}
            />
            <button className="min-h-[44px] shrink-0 rounded-full bg-brand-dark px-4 font-semibold text-white disabled:opacity-50" disabled={!text.trim() || send.isPending}>
              Send
            </button>
          </form>
        </>
      )}
    </section>
  );
}
