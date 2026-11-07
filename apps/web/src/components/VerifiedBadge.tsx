import { t } from "../i18n";
export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand-dark">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        <path d="M10 1l2.4 1.8 3 .1.9 2.8 2.4 1.8-.9 2.9.9 2.8-2.4 1.8-.9 2.9-3 .1L10 19l-2.4-1.8-3-.1-.9-2.9L1.3 12.4l.9-2.8-.9-2.9 2.4-1.8.9-2.8 3-.1z" />
        <path d="M8.6 12.6l-2.3-2.3 1-1 1.3 1.3 3.9-3.9 1 1z" fill="#fff" />
      </svg>
      {t("Verified")}
    </span>
  );
}
