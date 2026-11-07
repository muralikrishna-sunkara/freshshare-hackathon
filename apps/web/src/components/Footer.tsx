import { Link } from "react-router-dom";
import { t } from "../i18n";

const links = [
  ["/about", t("About")],
  ["/terms", t("Terms")],
  ["/privacy", t("Privacy")],
  ["/imprint", t("Imprint")],
  ["/contact", t("Contact")],
  ["/credits", t("Credits")],
] as const;

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <p>
          <span className="font-bold text-brand-dark">Fresh<span className="text-accent">Share</span></span> · {t("free food from neighbours, safely.")}
        </p>
        <nav aria-label={t("Footer")} className="flex flex-wrap gap-x-4 gap-y-2">
          {links.map(([to, label]) => (
            <Link key={to} to={to} className="hover:text-brand-dark hover:underline">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
