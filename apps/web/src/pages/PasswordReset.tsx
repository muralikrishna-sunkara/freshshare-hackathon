import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { forgotPassword, resetPassword } from "../api/client";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { t } from "../i18n";
import { PasswordInput } from "../components/PasswordInput";

/** /forgot-password: ask for a reset link by email. */
export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const m = useMutation({ mutationFn: () => forgotPassword(email) });
  return (
    <Page title={t("Reset your password")}>
      {m.isSuccess ? (
        <div className="space-y-3" role="status">
          <p className="rounded-xl bg-brand-light p-4 text-brand-dark">{m.data.message} {t("Check your inbox (and spam). The link works for one hour.")}</p>
          <Link to="/signin" className="font-semibold text-brand-dark underline">{t("Back to sign in")}</Link>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <p className="text-sm text-stone-600">{t("Enter the email you signed up with and we'll send you a link to choose a new password.")}</p>
          <div>
            <label className={labelCls} htmlFor="email">{t("Email")}</label>
            <input id="email" type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <ErrorNote error={m.error} />
          <button className={primaryBtn} disabled={m.isPending}>{m.isPending ? t("Sending…") : t("Send reset link")}</button>
          <p className="text-center text-sm"><Link to="/signin" className="font-semibold text-brand-dark underline">{t("Back to sign in")}</Link></p>
        </form>
      )}
    </Page>
  );
}

/** /reset-password?token=…: choose a new password from the emailed link. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const nav = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: (u) => {
      qc.setQueryData(["me"], u);
      nav("/map", { replace: true });
    },
  });
  const mismatch = again.length > 0 && again !== password;
  if (!token) {
    return (
      <Page title={t("Reset your password")}>
        <p className="text-stone-700">{t("This link is incomplete.")} <Link to="/forgot-password" className="font-semibold text-brand-dark underline">{t("Ask for a new one")}</Link>.</p>
      </Page>
    );
  }
  return (
    <Page title={t("Choose a new password")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!mismatch) m.mutate();
        }}
      >
        <div>
          <label className={labelCls} htmlFor="new-password">{t("New password")}</label>
          <PasswordInput id="new-password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-stone-500">{t("At least 8 characters.")}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="new-password-2">{t("Repeat it")}</label>
          <PasswordInput id="new-password-2" autoComplete="new-password" required minLength={8} value={again} onChange={(e) => setAgain(e.target.value)} />
          {mismatch && <p className="mt-1 text-sm text-red-700">{t("The two passwords don't match.")}</p>}
        </div>
        <ErrorNote error={m.error} />
        <button className={primaryBtn} disabled={m.isPending || mismatch || password.length < 8}>{m.isPending ? t("Saving…") : t("Save and sign in")}</button>
        {m.error && <p className="text-center text-sm"><Link to="/forgot-password" className="font-semibold text-brand-dark underline">{t("Send a new link")}</Link></p>}
      </form>
    </Page>
  );
}
