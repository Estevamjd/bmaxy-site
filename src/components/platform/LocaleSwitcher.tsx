"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { updateLocaleAction, type LocaleActionState } from "@/lib/actions/locale";
import type { PlatformContent, PlatformLocale } from "@/content/platform";

function LocaleButton({
  value,
  label,
  active,
}: {
  value: PlatformLocale;
  label: string;
  active: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="locale"
      value={value}
      disabled={pending || active}
      aria-current={active ? "true" : undefined}
      className={`min-h-11 rounded-[2px] px-3 text-[0.6875rem] font-medium uppercase tracking-[0.12em] transition-colors disabled:cursor-default ${
        active ? "bg-gold text-void" : "text-ash hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function PendingAnnouncement({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <span className="sr-only" aria-live="polite">
      {pending ? label : ""}
    </span>
  );
}

export function LocaleSwitcher({
  locale,
  labels,
}: {
  locale: PlatformLocale;
  labels: PlatformContent["localeSwitch"];
}) {
  const router = useRouter();
  const [state, action] = useActionState<LocaleActionState | undefined, FormData>(
    updateLocaleAction,
    undefined,
  );

  useEffect(() => {
    if (state?.status === "success") router.refresh();
  }, [router, state]);

  return (
    <div className="mb-6">
      <form action={action} aria-label={labels.label} className="flex w-fit gap-1 rounded-[3px] border border-line p-1">
        <LocaleButton value="pt" label="PT" active={locale === "pt"} />
        <LocaleButton value="en" label="EN" active={locale === "en"} />
        <PendingAnnouncement label={labels.pending} />
      </form>
      {state?.status === "error" ? (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
