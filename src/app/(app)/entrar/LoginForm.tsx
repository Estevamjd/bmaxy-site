"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthActionState } from "@/lib/actions/auth";
import { FormError, PasswordField, SubmitButton, TextField } from "@/components/platform/form";
import { TurnstileField } from "@/components/platform/TurnstileField";
import { platformHomePath, type PlatformContent, type PlatformLocale } from "@/content/platform";

export function LoginForm({
  next,
  locale,
  content,
}: {
  next: string;
  locale: PlatformLocale;
  content: PlatformContent;
}) {
  const copy = content.auth.login;
  const [state, formAction] = useActionState<AuthActionState, FormData>(loginAction, undefined);

  /* Muda a cada resposta do servidor e remonta o widget. O token do Turnstile
     é de uso único: sem isto, quem erra a senha uma vez reenvia o MESMO token
     e leva um erro de segurança em vez do erro de senha. */
  const tentativa = state ? JSON.stringify(state) : "inicial";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.error} />
      <TextField
        label={content.common.email}
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <PasswordField
        label={content.common.password}
        name="password"
        autoComplete="current-password"
        showLabel={content.common.showPassword}
        hideLabel={content.common.hidePassword}
      />
      <TurnstileField key={tentativa} locale={locale} />
      <SubmitButton pendingLabel={content.common.wait}>{copy.submit}</SubmitButton>

      {/* "Criar conta" fica separado e com destaque próprio: é o caminho de
          quem NÃO tem login ainda, e some no meio dos links auxiliares se
          entrar na mesma linha que "esqueci minha senha". */}
      <p className="border-t border-line pt-5 text-sm text-ash">
        {copy.noAccount}{" "}
        <Link href="/cadastro" className="text-gold hover:text-gold-hi">
          {copy.createAccount}
        </Link>
      </p>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm">
        <Link href="/recuperar-senha" className="text-ash hover:text-gold">
          {copy.forgotPassword}
        </Link>
        <Link href={platformHomePath(locale)} className="text-ash hover:text-gold">
          {content.common.backToSite}
        </Link>
      </div>
    </form>
  );
}
