import "server-only";
import type { PlatformLocale } from "@/content/platform";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * =============================================================================
 *  A COSTURA ENTRE A TELA DE CADASTRO E A PERSISTÊNCIA
 * =============================================================================
 *
 *  O cadastro público usa `supabase.auth.signUp`. Todo usuário nasce como
 *  student pelo trigger do banco e recebe a matrícula gratuita de `seu-livro`.
 *  Se a confirmação de e-mail estiver ativa no projeto, o retorno informa a
 *  interface para orientar a pessoa; se estiver desligada, a sessão já nasce.
 *
 *  Sem URL/chave publicável o fluxo continua falhando fechado com o estado
 *  `unavailable`: nenhuma tela finge que criou uma conta.
 * =========================================================================== */

export type CreateAccountInput = {
  fullName: string;
  email: string;
  password: string;
  locale: PlatformLocale;
};

export type CreateAccountOutcome =
  | { status: "created"; requiresEmailConfirmation: boolean }
  /** Nenhum provedor ligado — não é erro do usuário. */
  | { status: "unavailable" }
  | { status: "email_taken" }
  | { status: "failed"; reason: string };

/** O cadastro fica disponível assim que URL + chave publicável existem. */
export function signupAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<CreateAccountOutcome> {
  if (!signupAvailable()) return { status: "unavailable" };

  const supabase = await createClient();
  const { siteUrl } = getSupabaseEnv();
  // Sem `next`. Quem cadastra pelo site público sempre vira aluno (o trigger
  // handle_new_user cria a role 'student'), então escrever "/aluno" aqui daria
  // certo — mas seria a mesma aposta que já causou o bug de admin caindo na
  // área do aluno: um destino decidido antes de existir sessão. O callback lê a
  // role real e resolve. Se um dia esta conta nascer com outra role, o link do
  // e-mail continua levando para o lugar certo sozinho.
  const callback = `${siteUrl}/auth/callback`;

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName, locale: input.locale, signup_source: "public" },
      emailRedirectTo: callback,
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { status: "email_taken" };
    }
    return { status: "failed", reason: error.code ?? "signup_failed" };
  }

  if (!data.user) return { status: "failed", reason: "missing_user" };

  return {
    status: "created",
    requiresEmailConfirmation: !data.session,
  };
}
