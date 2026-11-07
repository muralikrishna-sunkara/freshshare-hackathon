import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { fetchImpactTotals, joinEarlyAccess, type EarlyAccessRole } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { Footer } from "../components/Footer";
import { ErrorNote, inputCls, labelCls } from "../components/Page";
import { useMe } from "../hooks/useMe";
import { t } from "../i18n";
import { FridgeIcon } from "../components/FridgeIcon";

const UN_SOURCE = "https://unstats.un.org/sdgs/report/2026/goal-12";
const DE_SOURCE = "https://www.bmleh.de/EN/topics/food-and-nutrition/food-waste/food-waste-latest-figures.html";

const ROLES: { value: EarlyAccessRole; label: string }[] = [
  { value: "giver", label: t("I have food to give") },
  { value: "receiver", label: t("I'd like to pick up food") },
  { value: "business", label: t("Shop, bakery or café") },
  { value: "fridge_host", label: t("I host a community fridge") },
  { value: "organization", label: t("Food bank or NGO") },
];

const FAQ: [string, string][] = [
  [t("Is it free?"), t("Yes. Food on FreshShare is always free, and so is the app. Nobody pays to give or to pick up.")],
  [t("Who can give food?"), t("Anyone 16 or older: households, students, shops, bakeries and cafés. Givers add a photo, a best-before date and say whether it's homemade, packaged or fresh produce.")],
  [t("How do I know it's safe?"), t("Every listing has a photo and a best-before date. Raw meat, raw fish and other high-risk food are banned, givers have star ratings and a Verified badge, and every listing has a report button.")],
  [t("Where does it work?"), t("We're starting in Erlangen and Herzogenaurach. The map shows food and community fridges within 2 km of you.")],
  [t("What do you do with my email?"), t("We only use it to tell you when FreshShare opens near you. We never share or sell it, and you can ask us to delete it any time.")],
];

/** Landing page. At "/" signed-in users go straight to the map; "/about" always shows it. */
export function Landing({ redirectSignedIn = false }: { redirectSignedIn?: boolean }) {
  const me = useMe();
  const [params] = useSearchParams();
  const legacyListing = params.get("listing"); // old share links were /?listing=<id>
  if (legacyListing) return <Navigate to={`/map?listing=${encodeURIComponent(legacyListing)}`} replace />;
  if (redirectSignedIn && me.data) return <Navigate to="/map" replace />;
  return (
    <div className="flex min-h-full flex-col bg-stone-50">
      <AppHeader />
      <main className="flex-1">
        <Hero />
        <Problem />
        <ImpactBar />
        <HowItWorks />
        <WhoFor />
        <Trust />
        <Faq />
        <EarlyAccess />
      </main>
      <Footer />
    </div>
  );
}

function Section({ id, title, children, tone = "plain" }: { id?: string; title: string; children: ReactNode; tone?: "plain" | "white" }) {
  return (
    <section id={id} className={tone === "white" ? "bg-white" : ""}>
      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
        <h2 className="mb-6 text-2xl font-bold lg:text-3xl">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="bg-brand-dark text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 lg:grid-cols-2 lg:px-6 lg:py-20">
        <div className="space-y-5">
          <h1 className="text-4xl font-extrabold leading-tight lg:text-5xl">{t("Good food shouldn't end up in the bin")}</h1>
          <p className="text-lg text-white/85">
            {t("FreshShare connects neighbours who have food left over with people nearby who'd love it. Post a photo, someone close by picks it up.")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/map" className="inline-flex min-h-[48px] items-center rounded-full bg-accent px-6 font-bold text-stone-900 hover:brightness-105">
              {t("Find food near me")}
            </Link>
            <a href="#early-access" className="inline-flex min-h-[48px] items-center rounded-full px-6 font-semibold text-white ring-1 ring-white/60 hover:bg-white/10">
              {t("Get early access")}
            </a>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-3 text-sm">
          {([
            ["📷", t("Photo + best-before date on every listing")],
            ["🗺️", t("Map of food within 2 km")],
            [<FridgeIcon className="h-7 w-7" />, t("Community fridges on the same map")],
            ["✅", t("Verified givers with star ratings")],
          ] as [ReactNode, string][]).map(([icon, text]) => (
            <li key={text} className="rounded-2xl bg-white/10 p-4">
              <span className="text-2xl" aria-hidden>{icon}</span>
              <p className="mt-2 font-semibold">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Problem() {
  const figures = [
    { n: t("1.05 billion tonnes"), text: t("of food were wasted in 2022, about 19% of the food available to consumers."), src: UN_SOURCE, label: "UN SDG Report 2026" },
    { n: t("About 60%"), text: t("of that waste comes from households."), src: UN_SOURCE, label: "UN SDG Report 2026" },
    { n: t("Up to 10%"), text: t("of global greenhouse gas emissions come from food loss and waste."), src: UN_SOURCE, label: "UN SDG Report 2026" },
  ];
  return (
    <Section title={t("The problem")} tone="white">
      <div className="grid gap-4 md:grid-cols-3">
        {figures.map((f) => (
          <figure key={f.n} className="rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200">
            <p className="text-2xl font-extrabold text-brand-dark">{f.n}</p>
            <p className="mt-1 text-stone-700">{f.text}</p>
            <a href={f.src} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-stone-500 underline">
              {t("Source:")} {f.label}, {t("Goal 12")}
            </a>
          </figure>
        ))}
      </div>
      <p className="mt-4 rounded-2xl bg-accent-light p-4 text-stone-800">
        <strong>{t("In Germany:")}</strong> {t("10.8 million tonnes a year, 58% from households, about 74.5 kg per person.")}{" "}
        <a href={DE_SOURCE} target="_blank" rel="noreferrer" className="text-xs text-stone-500 underline">
          {t("Source:")} BMLEH
        </a>
      </p>
    </Section>
  );
}

function ImpactBar() {
  const q = useQuery({ queryKey: ["impact-totals"], queryFn: fetchImpactTotals });
  const tot = q.data;
  const stats: [string, string | number | undefined][] = [
    [t("Meals shared"), tot?.meals],
    [t("kg of food saved"), tot?.kgSaved],
    [t("kg CO₂ avoided"), tot?.co2Kg],
    [t("Neighbours"), tot?.neighbours],
    [t("Community fridges"), tot?.fridges],
    [t("Organizations"), tot?.organizations],
  ];
  return (
    <Section title={t("FreshShare so far")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-live="polite">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-2xl bg-white p-4 text-center ring-1 ring-stone-200">
            {q.isLoading ? (
              <div className="mx-auto h-8 w-16 animate-pulse rounded bg-stone-200" />
            ) : (
              <p className="text-3xl font-extrabold text-brand-dark">{n ?? "–"}</p>
            )}
            <p className="mt-1 text-xs text-stone-600">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-500">
        {t("Counted live from completed pickups on FreshShare. kg is an estimate (0.4 kg per portion), CO₂ at 2.5 kg CO₂e per kg of food.")}
        {q.isError && ` ${t("Couldn't load the numbers right now.")}`}
      </p>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    ["1", t("Post it"), t("Snap a photo, add the best-before date and say if it's homemade, packaged or fresh produce. Under 30 seconds.")],
    ["2", t("A neighbour claims it"), t("People within 2 km see it on the map and reserve it. Your address stays hidden until you confirm.")],
    ["3", t("Hand it over"), t("Agree a time in the chat, meet at your door or a public handover spot, then rate each other.")],
  ];
  return (
    <Section title={t("How it works")} tone="white">
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map(([n, title, text]) => (
          <li key={n} className="rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white font-bold">{n}</span>
            <p className="mt-3 text-lg font-bold">{title}</p>
            <p className="text-stone-700">{text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function WhoFor() {
  const who = [
    ["🏠", t("Households"), t("Leftovers, too many apples, a fridge to clear before holidays.")],
    ["🙋", t("Receivers"), t("Students, families, anyone who'd rather eat it than see it binned.")],
    ["🥐", t("Shops and cafés"), t("End-of-day bread and pastries, short-dated stock.")],
    [<FridgeIcon className="h-7 w-7 text-brand-dark" />, t("Community fridges"), t("Show up on the map with opening hours and how full they are.")],
    ["🤝", t("Food banks and NGOs"), t("Collect several listings in one pickup run.")],
  ] as [ReactNode, string, string][];
  return (
    <Section title={t("Who it's for")}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {who.map(([icon, title, text]) => (
          <li key={title} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <span className="text-2xl" aria-hidden>{icon}</span>
            <p className="mt-2 font-bold">{title}</p>
            <p className="text-sm text-stone-600">{text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Trust() {
  const items = [
    [t("Food-safety rules"), t("Photo and best-before date are required. Homemade food leaves the map after 48 hours.")],
    [t("High-risk food banned"), t("No raw meat, minced meat, raw fish, raw-egg dishes or raw-milk products.")],
    [t("Ratings and Verified badge"), t("See a giver's stars and whether their email and phone are confirmed before you go.")],
    [t("Report button"), t("Every listing can be reported. Reports go straight to our moderators.")],
  ];
  return (
    <Section title={t("Built for trust")} tone="white">
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(([title, text]) => (
          <div key={title} className="flex gap-3 rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200">
            <span className="mt-0.5 text-brand" aria-hidden>✔</span>
            <div>
              <p className="font-bold">{title}</p>
              <p className="text-stone-700">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-stone-600">
        {t("Read the full")} <Link to="/terms" className="font-semibold text-brand-dark underline">{t("food sharing guidelines")}</Link>.
      </p>
    </Section>
  );
}

function Faq() {
  return (
    <Section title={t("Questions")}>
      <div className="space-y-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="mr-2 inline-block text-brand transition group-open:rotate-90" aria-hidden>›</span>
              {q}
            </summary>
            <p className="mt-2 text-stone-700">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function EarlyAccess() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EarlyAccessRole | "">("");
  const [postcode, setPostcode] = useState("");
  const [consent, setConsent] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ role?: string; consent?: string }>({});
  const m = useMutation({
    mutationFn: () =>
      joinEarlyAccess({
        email,
        role: role as EarlyAccessRole,
        postcode: postcode || undefined,
        source: params.get("src") ?? undefined,
        language: navigator.language?.slice(0, 5),
        consent,
      }),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = { role: role ? undefined : t("Please pick one"), consent: consent ? undefined : t("Please tick this so we can email you") };
    setFieldErr(errs);
    if (errs.role || errs.consent) return;
    m.mutate();
  };
  return (
    <section id="early-access" className="bg-brand-light">
      <div className="mx-auto max-w-xl px-4 py-12 lg:py-16">
        <h2 className="mb-2 text-2xl font-bold lg:text-3xl">{t("Get early access")}</h2>
        <p className="mb-6 text-stone-700">{t("We'll email you once when FreshShare opens in your area. Nothing else.")}</p>
        {m.isSuccess ? (
          <div role="status" className="rounded-2xl bg-white p-6 text-center ring-1 ring-stone-200">
            <p className="text-3xl" aria-hidden>🎉</p>
            <p className="mt-2 text-lg font-bold">{t("Thank you, you're on the list!")}</p>
            <p className="text-stone-600">{t("We'll let you know at {email} when we launch near you.", { email: email.trim().toLowerCase() })}</p>
            <Link to="/map" className="mt-4 inline-block font-semibold text-brand-dark underline">{t("Have a look at the map meanwhile")}</Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <div>
              <label className={labelCls} htmlFor="ea-email">{t("Email")}</label>
              <input id="ea-email" type="email" required autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <fieldset>
              <legend className={labelCls}>{t("How would you use FreshShare?")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <label key={r.value} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-3 ring-1 ${role === r.value ? "bg-brand-light ring-brand" : "ring-stone-300"}`}>
                    <input type="radio" name="ea-role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
              {fieldErr.role && <p className="mt-1 text-sm text-red-700">{fieldErr.role}</p>}
            </fieldset>
            <div>
              <label className={labelCls} htmlFor="ea-postcode">{t("Postcode")} <span className="font-normal text-stone-500">({t("optional")})</span></label>
              <input id="ea-postcode" inputMode="numeric" maxLength={10} className={inputCls} value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder={t("e.g. 91054")} />
            </div>
            <div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  {t("FreshShare may email me about the launch. I can unsubscribe any time. See our")} <Link to="/privacy" className="underline">{t("privacy notice")}</Link>.
                </span>
              </label>
              {fieldErr.consent && <p className="mt-1 text-sm text-red-700">{fieldErr.consent}</p>}
            </div>
            <ErrorNote error={m.error} />
            <button className="w-full min-h-[48px] rounded-full bg-brand-dark px-6 font-bold text-white hover:brightness-110 disabled:opacity-50" disabled={m.isPending}>
              {m.isPending ? t("Saving…") : t("Join early access")}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
