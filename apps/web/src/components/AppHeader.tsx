import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useMe } from "../hooks/useMe";
import { lang, setLang, t } from "../i18n";
import { useUnreadCount } from "../hooks/useUnreadCount";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-brand-light text-brand-dark" : "text-stone-600 hover:bg-stone-100"}`;

/** Top navigation for the web app (all pages). Below 768 px the links collapse into a menu button. */
export function AppHeader() {
  const me = useMe();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(!!me.data);
  const links: [string, string][] = [
    ["/map", t("Find food")],
    ["/fridges", t("Fridges")],
    ["/organizations", t("Organizations")],
    ...(me.data ? ([["/pickups", t("My pickups")]] as [string, string][]) : []),
    ...(me.data?.role === "admin" ? ([["/admin", t("Admin")]] as [string, string][]) : []),
  ];
  return (
    <header className="relative z-[1100] shrink-0 border-b border-stone-200 bg-white">
      <div className="flex h-16 items-center gap-2 px-4 lg:px-6">
        <Link to={me.data ? "/map" : "/"} className="mr-2 text-xl font-extrabold tracking-tight text-brand-dark lg:mr-6">
          Fresh<span className="text-accent">Share</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("Main")}>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={navCls}>{label}</NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/share" className="whitespace-nowrap rounded-full bg-accent px-4 py-2 text-sm font-bold text-white shadow-sm hover:brightness-95">
            + {t("Share food")}
          </Link>
          {me.data && (
            <Link
              to="/notifications"
              aria-label={unread ? t("Notifications, {n} unread", { n: unread }) : t("Notifications")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-stone-100"
            >
              <span aria-hidden>🔔</span>
              {unread > 0 && (
                <span data-testid="unread-badge" className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          )}
          {me.data ? (
            <Link
              to="/profile"
              aria-label={t("Profile of {name}", { name: me.data.name })}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 hover:bg-stone-100 lg:pr-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{me.data.name.charAt(0)}</span>
              <span className="hidden text-sm font-semibold lg:inline">{me.data.name}</span>
            </Link>
          ) : (
            <>
              <Link to={`/signin?next=${encodeURIComponent(loc.pathname === "/" ? "/map" : loc.pathname + loc.search)}`} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-brand-dark hover:bg-stone-100">{t("Sign in")}</Link>
              <Link to="/signup" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50 lg:inline">
                {t("Sign up")}
              </Link>
            </>
          )}
          <LanguageSwitch className="hidden sm:flex" />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-xl ring-1 ring-stone-300 md:hidden"
            aria-label={t("Menu")}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "×" : "☰"}
          </button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-stone-200 p-3 md:hidden" aria-label={t("Mobile")}>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={navCls} onClick={() => setOpen(false)}>{label}</NavLink>
          ))}
          {!me.data && <NavLink to="/signup" className={navCls} onClick={() => setOpen(false)}>{t("Sign up")}</NavLink>}
          <LanguageSwitch className="mt-2 flex self-start sm:hidden" />
        </nav>
      )}
    </header>
  );
}

/** EN | DE toggle (T2.7). Switching reloads the page in the other language. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  return (
    <div className={`items-center rounded-full bg-stone-100 p-0.5 text-xs font-bold ${className}`} role="group" aria-label={t("Language")}>
      {(["en", "de"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => lang !== l && setLang(l)}
          className={`min-h-[32px] rounded-full px-2.5 ${lang === l ? "bg-white text-stone-900 shadow" : "text-stone-500 hover:text-stone-800"}`}
          title={l === "en" ? "English" : "Deutsch"}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
