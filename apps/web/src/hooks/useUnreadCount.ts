import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchNotifications } from "../api/client";

/**
 * Unread notification count for the header bell. Live over Server-Sent Events (/api/notifications/stream);
 * falls back to polling every 30 s if the stream can't be opened.
 */
export function useUnreadCount(enabled: boolean) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, enabled, refetchInterval: 30_000 });
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const es = new EventSource("/api/notifications/stream", { withCredentials: true });
    let first = true;
    es.addEventListener("unread", (e) => {
      const { unreadCount } = JSON.parse((e as MessageEvent).data) as { unreadCount: number };
      const cached = qc.getQueryData<{ unreadCount: number }>(["notifications"]);
      // Something new arrived: refresh the list too (the page shows it without a reload).
      if (!first && cached && unreadCount !== cached.unreadCount) qc.invalidateQueries({ queryKey: ["notifications"] });
      else if (cached) qc.setQueryData(["notifications"], { ...cached, unreadCount });
      first = false;
    });
    return () => es.close();
  }, [enabled, qc]);
  return q.data?.unreadCount ?? 0;
}
