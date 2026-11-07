import { useState, type InputHTMLAttributes } from "react";
import { t } from "../i18n";
import { inputCls } from "./Page";

/** Password field with a Show/Hide toggle. The button's name is just "Show"/"Hide" so the field keeps its own label. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & { id: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`${inputCls} pr-20`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-controls={props.id}
        className="absolute inset-y-0 right-1 my-1 rounded-lg px-3 text-sm font-semibold text-brand-dark hover:bg-stone-100"
      >
        {shown ? t("Hide") : t("Show")}
      </button>
    </div>
  );
}
