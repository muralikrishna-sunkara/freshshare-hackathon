import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Page } from "../components/Page";
import { TermsText } from "../components/TermsText";
import { PHOTO_CREDITS } from "../content/credits";
import { CONTACT_EMAIL } from "../content/site";

const Prose = ({ children }: { children: ReactNode }) => (
  <div className="space-y-4 rounded-2xl bg-white p-5 leading-relaxed text-stone-700 ring-1 ring-stone-200 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-stone-900">
    {children}
  </div>
);
const Mail = () => (
  <a className="font-semibold text-brand-dark underline" href={`mailto:${CONTACT_EMAIL}`}>
    {CONTACT_EMAIL}
  </a>
);

export function TermsPage() {
  return (
    <Page title="Terms & Conditions">
      <Prose>
        <TermsText />
      </Prose>
    </Page>
  );
}

export function ImprintPage() {
  return (
    <Page title="Imprint">
      <Prose>
        <p>
          FreshShare is a neighbourhood food-sharing project built at a one-day hackathon on 7 November 2026. It is a free, non-commercial
          service in a pilot phase around Erlangen and Herzogenaurach.
        </p>
        <h2>Contact</h2>
        <p>
          Email: <Mail />
        </p>
        <h2>Responsible for content</h2>
        <p>The FreshShare team. Listings, photos and messages are written by our users, who are responsible for their own content.</p>
        <h2>Liability for links</h2>
        <p>We link to external sites such as the UN SDG Report and OpenStreetMap. We have no influence on their content.</p>
      </Prose>
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <Page title="Privacy">
      <Prose>
        <p>We collect as little as we can and never sell your data.</p>
        <h2>What we store</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your account: name, email, a password hash (never the password), an optional bio, and the home pin you set on the map.</li>
          <li>When you accepted our Terms & Conditions and which version.</li>
          <li>Your listings, pickups, chat messages, ratings and fridge check-ins.</li>
          <li>For early access: email, how you'd use FreshShare, an optional postcode and the link you came from.</li>
        </ul>
        <h2>Your location</h2>
        <p>
          Other people only see an area about 150 m around your pin, never your address. The exact spot and pickup details are shown only to
          the neighbour whose pickup you confirm. Photos are re-encoded on upload, which removes hidden location data (EXIF).
        </p>
        <h2>Where it lives</h2>
        <p>On Amazon Web Services in Frankfurt (eu-central-1). Map tiles come from OpenStreetMap.</p>
        <h2>Your rights</h2>
        <p>
          You can ask for a copy of your data, a correction or deletion at any time: <Mail />.
        </p>
        <h2>Cookies</h2>
        <p>One cookie keeps you signed in. No tracking or advertising cookies.</p>
      </Prose>
    </Page>
  );
}

export function ContactPage() {
  return (
    <Page title="Contact">
      <Prose>
        <p>
          Questions, ideas, or want FreshShare in your neighbourhood? Write to us at <Mail />.
        </p>
        <p>
          Run a food bank, NGO or community fridge? Tell us, or <Link to="/about#early-access" className="font-semibold text-brand-dark underline">join early access</Link>{" "}
          as an organization or fridge host.
        </p>
        <p>Something unsafe on a listing? Use the Report button on the listing so our moderators see it straight away.</p>
      </Prose>
    </Page>
  );
}

export function CreditsPage() {
  return (
    <Page title="Photo credits" wide>
      <Prose>
        <p>
          The demo food photos come from Wikimedia Commons and are used under the licences below. They were resized and cropped; no other
          changes. Photos that neighbours upload are their own.
        </p>
        <p>
          Map data © <a className="text-brand-dark underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PHOTO_CREDITS.map((c) => (
            <li key={c.file} className="rounded-xl bg-stone-50 p-3 text-sm ring-1 ring-stone-200">
              <a className="font-semibold text-brand-dark underline" href={c.sourceUrl} target="_blank" rel="noreferrer">{c.source}</a>
              <p>by {c.author}</p>
              <p>
                {c.licenseUrl ? <a className="underline" href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a> : c.license}
              </p>
            </li>
          ))}
        </ul>
      </Prose>
    </Page>
  );
}

export function NotFoundPage() {
  return (
    <Page title="Page not found">
      <Prose>
        <p>We couldn't find that page. It may have been removed, or the link has a typo.</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/map" className="rounded-full bg-brand-dark px-5 py-2.5 font-bold text-white">Find food near you</Link>
          <Link to="/" className="rounded-full px-5 py-2.5 font-semibold ring-1 ring-stone-300">Home</Link>
        </div>
      </Prose>
    </Page>
  );
}
