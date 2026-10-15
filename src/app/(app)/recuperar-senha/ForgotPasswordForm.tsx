"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type AuthActionState } from "@/lib/actions/auth";
import { FormError, FormSuccess, SubmitButton, TextField } from "@/components/platform/form";
import { TurnstileField } from "@/components/platform/TurnstileField";
import type { PlatformContent, PlatformLocale } from "@/content/platform";

export function ForgotPasswordForm({
  locale,
  content,
}: {
  locale: PlatformLocale;
  content: PlatformContent;
}) {
  const copy = content.auth.forgot;
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    requestPasswordResetAction,
    undefined,
  );

  /* Muda a cada resposta do servidor e remonta o widget. O token do Turnstile
     é de uso único: sem isto, um segundo envio manda o MESMO token e a
     Cloudflare responde `timeout-or-duplicate`. */
  const tentativa = state ? JSON.stringify(state) : "inicial";

  if (state?.success) {
    return (
      <div>
        <FormSuccess message={state.success} />
        <Link
          href="/entrar"
          className="inline-flex min-h-11 items-center font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold hover:text-gold-hi"
        >
          {copy.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError message={state?.error} />
      <TextField label={content.common.email} name="email" type="email" autoComplete="email" required />
      <TurnstileField key={tentativa} locale={locale} />
      <SubmitButton pendingLabel={content.common.wait}>{copy.submit}</SubmitButton>
      <Link href="/entrar" className="block pt-2 text-sm text-ash hover:text-gold">
        {copy.backToLogin}
      </Link>
    </form>
  );
}
