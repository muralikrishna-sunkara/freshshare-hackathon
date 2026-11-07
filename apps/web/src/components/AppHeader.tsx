import { Link, NavLink } from "react-router-dom";
import { useMe } from "../hooks/useMe";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-brand-light text-brand-dark" : "text-stone-600 hover:bg-stone-100"}`;

/** Top navigation for the web app (all pages). */
export function AppHeader() {
  const me = useMe();
  return (
    <header className="z-[1100] flex h-16 shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-4 lg:px-6">
      <Link to="/" className="mr-2 text-xl font-extrabold tracking-tight text-brand-dark lg:mr-6">
        Fresh<span className="text-accent">Share</span>
      </Link>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
        <NavLink to="/" end className={navCls}>Find food</NavLink>
        {me.data && <NavLink to="/pickups" className={navCls}>My pickups</NavLink>}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Link to="/share" className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white shadow-sm hover:brightness-95">
          + Share food
        </Link>
        {me.data ? (
          <>
            <NavLink to="/pickups" className={(a) => `${navCls(a)} md:hidden`}>Pickups</NavLink>
            <Link
              to="/profile"
              aria-label={`Profile of ${me.data.name}`}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 hover:bg-stone-100 lg:pr-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{me.data.name.charAt(0)}</span>
              <span className="hidden text-sm font-semibold lg:inline">{me.data.name}</span>
            </Link>
          </>
        ) : (
          <>
            <Link to="/signin" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-dark hover:bg-stone-100">Sign in</Link>
            <Link to="/signup" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50 sm:inline">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
