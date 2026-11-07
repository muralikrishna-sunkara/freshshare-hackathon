import { TERMS, TERMS_FOOTNOTE, TERMS_TITLE, TERMS_VERSION } from "../content/terms";

/** The full Terms & Conditions text, used in the sign-up dialog and on /terms. */
export function TermsText({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="space-y-5 text-sm leading-relaxed text-stone-700">
      <p className="text-base font-bold text-stone-900">{TERMS_TITLE}</p>
      {TERMS.map((s) => {
        const List = s.kind === "numbered" ? "ol" : "ul";
        return (
          <section key={s.heading}>
            <H className="mb-2 font-bold text-stone-900">{s.heading}</H>
            <List className={`space-y-1.5 pl-5 ${s.kind === "numbered" ? "list-decimal" : "list-disc"}`}>
              {s.items.map((i) => (
                <li key={i.text}>
                  {i.title && <strong>{i.title}: </strong>}
                  {i.text}
                </li>
              ))}
            </List>
          </section>
        );
      })}
      <p>{TERMS_FOOTNOTE}</p>
      <p className="text-xs text-stone-500">Version {TERMS_VERSION}</p>
    </div>
  );
}
