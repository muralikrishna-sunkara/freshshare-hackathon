import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification, type NotificationType } from "../api/client";
import { ErrorNote, Page } from "../components/Page";
import { Empty, Skeleton } from "../components/States";
import { timeAgo } from "../lib/format";

const ICON: Record<NotificationType, string> = {
  claim_received: "🙋",
  claim_confirmed: "✅",
  claim_cancelled: "↩️",
  new_message: "💬",
  listing_expiring_soon: "⏰",
  new_listing_nearby: "📍",
  waitlist_offer: "🎟️",
  fridge_approved: "✅",
  org_approved: "🏛️",
};

/** /notifications: everything that happened to me, newest first, with mark-all-read. */
export function NotificationsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications });
  const all = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  const open = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (n.link) nav(n.link);
  };
  const unread = q.data?.unreadCount ?? 0;
  return (
    <Page title="Notifications">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">{unread ? `${unread} unread` : "You're all caught up."}</p>
        <button
          className="min-h-[40px] rounded-full px-4 text-sm font-semibold ring-1 ring-stone-300 disabled:opacity-50"
          disabled={!unread || all.isPending}
          onClick={() => all.mutate()}
        >
          Mark all as read
        </button>
      </div>
      <ErrorNote error={q.error ?? all.error} />
      {q.isLoading && <Skeleton rows={4} />}
      {q.data && q.data.notifications.length === 0 && (
        <Empty title="No notifications yet">You'll hear here when someone reserves your food, confirms your pickup or sends you a message.</Empty>
      )}
      {q.data && q.data.notifications.length > 0 && (
        <ul className="space-y-2">
          {q.data.notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={`flex w-full gap-3 rounded-2xl p-4 text-left ring-1 transition hover:ring-brand ${n.read ? "bg-white ring-stone-200" : "bg-brand-light/60 ring-brand/30"}`}
              >
                <span aria-hidden className="text-2xl">{ICON[n.type]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className={`font-semibold ${n.read ? "text-stone-800" : "text-stone-900"}`}>{n.title}</span>
                    <span className="shrink-0 text-xs text-stone-500">{timeAgo(n.createdAt)}</span>
                  </span>
                  <span className="block text-sm text-stone-600">{n.body}</span>
                </span>
                {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
