import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { login } from "../api/client";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { PasswordInput } from "../components/PasswordInput";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [params] = useSearchParams();
  const next = params.get("next") || "/map";
  const nav = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      nav(next, { replace: true });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  return (
    <Page title="Sign in">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className={labelCls} htmlFor="password">Password</label>
            <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="text-sm font-semibold text-brand-dark underline">Forgot password?</Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ErrorNote error={m.error} />
        <button className={primaryBtn} disabled={m.isPending}>{m.isPending ? "Signing in…" : "Sign in"}</button>
        <p className="text-center text-sm text-stone-600">
          New here? <Link className="font-semibold text-brand-dark underline" to={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </p>
        <p className="rounded-xl bg-accent-light p-3 text-xs text-stone-700">
          <strong>DEMO:</strong> seeded users such as sara@demo.freshshare.de sign in with the password <code>freshshare-demo</code>.
        </p>
      </form>
    </Page>
  );
}
