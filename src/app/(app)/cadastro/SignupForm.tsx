"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  CheckboxField,
  FormError,
  FormNotice,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/platform/form";
import { signUpAction, type SignupActionState } from "@/lib/actions/signup";
import { TurnstileField } from "@/components/platform/TurnstileField";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/signup";
import {
  platformHomePath,
  type PlatformContent,
  type PlatformLocale,
} from "@/content/platform";

/**
 * Formulário de cadastro. A validação de verdade é a do Server Action (mesmo
 * schema Zod) — os atributos `required`/`minLength`/`type="email"` aqui são
 * só o primeiro aviso do navegador, para quem erra não precisar esperar uma
 * ida ao servidor.
 *
 * `noValidate` está de propósito no <form>: sem ele o navegador bloqueia o
 * envio com um balão nativo e o nosso texto de erro (que é o que fica
 * associado ao campo por aria-describedby) nunca chega a aparecer.
 *
 * Os quatro estados de `signUpAction` têm tratamento distinto aqui:
 * carregando (SubmitButton), erro de campo, aviso neutro de indisponível e
 * sucesso — este último só aparece quando uma conta for criada de verdade.
 */
export function SignupForm({
  locale,
  content,
}: {
  locale: PlatformLocale;
  content: PlatformContent;
}) {
  const copy = content.auth.signup;
  const [state, formAction] = useActionState<SignupActionState, FormData>(
    signUpAction,
    undefined,
  );

  /* Muda a cada resposta do servidor e remonta o widget. O token do Turnstile
     é de uso único: sem isto, um segundo envio manda o MESMO token e a
     Cloudflare responde `timeout-or-duplicate`. */
  const tentativa = state ? JSON.stringify(state) : "inicial";

  const fieldErrors = state?.fieldErrors;

  if (state?.status === "success") {
    return (
      <div>
        <p
          role="status"
          className="border border-gold/40 bg-gold/10 px-4 py-3 text-sm leading-relaxed text-gold"
        >
          {state.message ?? copy.successFallback}
        </p>
        <Link
          href="/entrar"
          className="mt-6 inline-flex min-h-11 items-center font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold hover:text-gold-hi"
        >
          {copy.goToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state?.status === "unavailable" ? (
        <FormNotice message={state.message} />
      ) : null}
      {state?.status === "error" ? <FormError message={state.message} /> : null}

      <TextField
        label={copy.fullName}
        name="fullName"
        type="text"
        autoComplete="name"
        required
        defaultValue={state?.values?.fullName ?? ""}
        error={fieldErrors?.fullName}
      />
      <TextField
        label={content.common.email}
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state?.values?.email ?? ""}
        error={fieldErrors?.email}
      />
      {/* Senhas nunca voltam preenchidas do servidor — nem depois de um erro
          em outro campo. */}
      <PasswordField
        label={copy.passwordLabel.replace("{minimum}", String(MIN_PASSWORD_LENGTH))}
        name="password"
        autoComplete="new-password"
        error={fieldErrors?.password}
        showLabel={content.common.showPassword}
        hideLabel={content.common.hidePassword}
      />
      <PasswordField
        label={copy.confirmPassword}
        name="confirmPassword"
        autoComplete="new-password"
        error={fieldErrors?.confirmPassword}
        showLabel={content.common.showPassword}
        hideLabel={content.common.hidePassword}
      />

      <CheckboxField name="acceptTerms" error={fieldErrors?.acceptTerms}>
        {copy.acceptPrefix}{" "}
        <Link href={locale === "en" ? "/en/terms" : "/termos"} className="text-gold hover:text-gold-hi">
          {copy.terms}
        </Link>{" "}
        {copy.acceptMiddle}{" "}
        <Link href={locale === "en" ? "/en/privacy" : "/privacidade"} className="text-gold hover:text-gold-hi">
          {copy.privacy}
        </Link>
        .
      </CheckboxField>

      <TurnstileField key={tentativa} locale={locale} />
      <SubmitButton pendingLabel={content.common.wait}>{copy.submit}</SubmitButton>

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 pt-2 text-sm">
        <Link href="/entrar" className="text-ash hover:text-gold">
          {copy.hasAccount}
        </Link>
        <Link href={platformHomePath(locale)} className="text-ash hover:text-gold">
          {content.common.backToSite}
        </Link>
      </div>
    </form>
  );
}
