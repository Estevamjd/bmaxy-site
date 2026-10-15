"use server";

import { createAccount } from "@/lib/auth/signup-provider";
import { platformContent } from "@/content/platform";
import { getPlatformLocale } from "@/lib/i18n/locale";
import { mensagemTurnstile, verificarTurnstile } from "@/lib/security/turnstile";
import { createSignupSchema, type SignupField } from "@/lib/validation/signup";

/**
 * Server Action do cadastro público.
 *
 * A UI trata quatro estados e todos existem aqui: `idle`, `error` (com erros
 * por campo), `unavailable` (não há provedor ligado — ver
 * src/lib/auth/signup-provider.ts) e `success`.
 *
 * `unavailable` é um estado SEPARADO de `error` de propósito: não é culpa de
 * quem preencheu, e a tela precisa dizer isso com outras palavras e outra
 * cor. E, principalmente: nunca devolvemos `success` sem que uma conta tenha
 * sido criada de verdade.
 *
 * `values` devolve nome e e-mail para o formulário não se apagar depois de um
 * envio inválido. As senhas NÃO voltam — nem por conveniência.
 */
export type SignupActionState =
  | {
      status: "error" | "unavailable" | "success";
      message?: string;
      fieldErrors?: Partial<Record<SignupField, string>>;
      values?: { fullName: string; email: string };
    }
  | undefined;

export async function signUpAction(
  _prevState: SignupActionState,
  formData: FormData,
): Promise<SignupActionState> {
  const locale = await getPlatformLocale();
  const messages = platformContent[locale].actions;
  const rawFullName = String(formData.get("fullName") ?? "");
  const rawEmail = String(formData.get("email") ?? "");
  const values = { fullName: rawFullName, email: rawEmail };

  /* O desafio anti-abuso vem ANTES de tudo, inclusive da validação Zod.
     Cadastro é o formulário mais atraente para automação: cada envio aceito
     dispara um e-mail de confirmação, e um script solto vira envio em massa
     partindo do nosso domínio — o tipo de coisa que queima reputação de
     remetente e é lenta de reverter. */
  const token = formData.get("cf-turnstile-response");
  const barrado = mensagemTurnstile(
    await verificarTurnstile(typeof token === "string" ? token : null),
    locale,
  );
  if (barrado) {
    return { status: "error", message: barrado, values };
  }

  const parsed = createSignupSchema(locale).safeParse({
    fullName: rawFullName,
    email: rawEmail,
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    // O checkbox chega como "on" quando marcado e ausente quando não.
    acceptTerms: formData.get("acceptTerms") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<SignupField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      // Só a primeira mensagem de cada campo: a segunda seria ruído embaixo
      // do mesmo input.
      if (typeof field === "string" && !(field in fieldErrors)) {
        fieldErrors[field as SignupField] = issue.message;
      }
    }
    return { status: "error", fieldErrors, values };
  }

  const outcome = await createAccount({
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    password: parsed.data.password,
    locale,
  });

  switch (outcome.status) {
    case "created":
      return {
        status: "success",
        message: outcome.requiresEmailConfirmation
          ? messages.signupConfirmEmail
          : messages.signupSuccess,
      };
    case "email_taken":
      return {
        status: "error",
        fieldErrors: { email: messages.signupEmailTaken },
        values,
      };
    case "failed":
      return {
        status: "error",
        message: messages.signupFailed,
        values,
      };
    case "unavailable":
    default:
      return { status: "unavailable", message: messages.signupUnavailable, values };
  }
}
