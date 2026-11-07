import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { register } from "../api/client";
import { LocationPicker } from "../components/LocationPicker";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { TermsDialog } from "../components/TermsDialog";
import { DEMO_CENTRE } from "../hooks/useLocation";

export function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [home, setHome] = useState(DEMO_CENTRE);
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [consentErr, setConsentErr] = useState<{ age?: string; terms?: string }>({});
  const [params] = useSearchParams();
  const next = params.get("next") || "/map";
  const nav = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => register({ name, email, password, homeLat: home.lat, homeLng: home.lng, ageConfirmed: age, termsAccepted: terms }),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      nav(next, { replace: true });
    },
  });
  const useMyLocation = () =>
    navigator.geolocation?.getCurrentPosition((p) => setHome({ lat: p.coords.latitude, lng: p.coords.longitude }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = {
      age: age ? undefined : "You must be 16 or older to use FreshShare",
      terms: terms ? undefined : "Please read and accept the Terms & Conditions",
    };
    setConsentErr(errs);
    if (errs.age || errs.terms) return;
    m.mutate();
  };
  return (
    <Page title="Create your account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="name">Your name</label>
          <input id="name" required minLength={2} autoComplete="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anna K." />
        </div>
        <div>
          <label className={labelCls} htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-stone-500">At least 8 characters.</p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className={labelCls + " mb-0"}>Home location</span>
            <button type="button" onClick={useMyLocation} className="text-sm font-semibold text-brand-dark underline">Use my location</button>
          </div>
          <LocationPicker value={home} onChange={setHome} />
          <p className="mt-1 text-xs text-stone-500">Tap the map. Neighbours only ever see an area about 150 m around it, never your address, until you confirm a pickup.</p>
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={age} onChange={(e) => setAge(e.target.checked)} />
            <span>I am 16 or older *</span>
          </label>
          {consentErr.age && <p className="mt-1 text-sm text-red-700">{consentErr.age}</p>}
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={terms}
              aria-describedby="terms-help"
              onChange={(e) => {
                // Ticking happens only through "I Accept" in the dialog; unticking is allowed.
                if (e.target.checked) setTermsOpen(true);
                else setTerms(false);
              }}
            />
            <span>
              I accept the{" "}
              <button type="button" className="font-semibold text-brand-dark underline" onClick={() => setTermsOpen(true)}>
                Terms & Conditions
              </button>{" "}
              *
            </span>
          </label>
          <p id="terms-help" className="ml-6 mt-1 text-xs text-stone-500">You must read and accept our food sharing etiquette guidelines</p>
          {consentErr.terms && <p className="ml-6 mt-1 text-sm text-red-700">{consentErr.terms}</p>}
        </div>
        <TermsDialog
          open={termsOpen}
          onAccept={() => {
            setTerms(true);
            setTermsOpen(false);
            setConsentErr((c) => ({ ...c, terms: undefined }));
          }}
          onDecline={() => {
            setTerms(false);
            setTermsOpen(false);
          }}
        />
        <ErrorNote error={m.error} />
        <button className={primaryBtn} disabled={m.isPending}>{m.isPending ? "Creating…" : "Create account"}</button>
        <p className="text-center text-sm text-stone-600">
          Already have an account? <Link className="font-semibold text-brand-dark underline" to={`/signin?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </p>
      </form>
    </Page>
  );
}
