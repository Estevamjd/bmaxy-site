"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { platformContent, type PlatformContent } from "@/content/platform";
import { resolvePostAuthDestination } from "@/lib/auth/roles";
import { getPlatformLocale, localeHomePath, setLocaleCookie } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { mensagemTurnstile, verificarTurnstile } from "@/lib/security/turnstile";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";
import {
  createForgotPasswordSchema,
  createLoginSchema,
  createResetPasswordSchema,
} from "@/lib/validation/auth";

export type AuthActionState = { error?: string; success?: string } | undefined;

function readNext(formData: FormData): string | null {
  const value = formData.get("next");
  return typeof value === "string" ? value : null;
}

/**
 * Roda o desafio anti-abuso ANTES de qualquer chamada ao Supabase.
 *
 * A ordem importa por dois motivos. O óbvio: não gastar cota de Auth com
 * tráfego automatizado. O menos óbvio: se o Turnstile rodasse depois, cada
 * tentativa de força bruta ainda contaria para o rate limit do Supabase, e o
 * atacante conseguiria negar login à pessoa legítima só enchendo o balde.
 *
 * Devolve a mensagem de erro quando reprova, ou `null` quando pode seguir.
 */
async function barrarAbuso(formData: FormData, locale: "pt" | "en"): Promise<string | null> {
  const token = formData.get("cf-turnstile-response");
  const resultado = await verificarTurnstile(typeof token === "string" ? token : null);
  return mensagemTurnstile(resultado, locale);
}

/* ---------------------------- falhas de login -----------------------------
 *
 * A regra que não pode ser quebrada: a mensagem de credencial inválida é
 * IDÊNTICA para e-mail inexistente e para senha errada. Distinguir os dois
 * transformaria a tela de login num verificador de "quem tem conta aqui".
 *
 * Rate limit e e-mail não confirmado podem ser distinguidos sem abrir essa
 * porta: o 429 é sobre o IP que está tentando, não sobre a conta; e
 * `email_not_confirmed` o Supabase só devolve quando a senha ESTAVA certa —
 * quem chega nessa mensagem já provou saber a senha, não descobriu nada novo.
 */
/**
 * Traduz a falha do signInWithPassword em algo verdadeiro.
 *
 * Antes, TODA falha virava "e-mail ou senha incorretos" — inclusive o 429 de
 * rate limit. Isso já custou um diagnóstico errado numa auditoria: a
 * credencial estava certa e a tela afirmava que estava errada, então o tempo
 * foi gasto procurando problema na senha.
 *
 * Nenhum ramo devolve `error.message`: o texto do provedor é interno e não é
 * escrito para quem está na tela.
 */
function loginErrorMessage(
  error: AuthError | null,
  messages: PlatformContent["actions"],
): string {
  // Sem erro e sem usuário: não deveria acontecer, e chutar "senha errada"
  // aqui seria repetir exatamente o problema que este mapa resolve.
  if (!error) return messages.loginUnavailable;

  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return messages.loginRateLimited;
  }
  if (error.code === "email_not_confirmed") return messages.emailNotConfirmed;
  if (error.code === "invalid_credentials") return messages.loginInvalid;

  // Versões mais antigas do GoTrue respondem 400 sem `code`. Neste endpoint,
  // 400 é credencial recusada.
  if (!error.code && error.status === 400) return messages.loginInvalid;

  return messages.loginUnavailable;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = await getPlatformLocale();
  const messages = platformContent[locale].actions;
  if (!isSupabaseConfigured()) return { error: messages.platformUnavailable };

  const barrado = await barrarAbuso(formData, locale);
  if (barrado) return { error: barrado };

  const parsed = createLoginSchema(locale).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? messages.invalidData };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: loginErrorMessage(error, messages) };
  }

  const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle(),
    supabase
      .from("profiles")
      .select("locale, must_change_password")
      .eq("id", data.user.id)
      .maybeSingle(),
  ]);

  if (!roleRow?.role) {
    redirect("/acesso-negado");
  }

  const profileLocale = profileRow?.locale ?? locale;
  await setLocaleCookie(profileLocale);

  /* Só AQUI o destino existe, porque só aqui a role real já foi lida de
   * public.user_roles. resolvePostAuthDestination faz três coisas, nesta
   * ordem: barra redirecionamento aberto, cai na casa da role quando não há
   * `next` aproveitável, e recusa um `next` que pertence à outra área (aluno
   * pedindo /admin, admin com um /aluno/... guardado num link antigo). */
  const next = resolvePostAuthDestination(readNext(formData), roleRow.role);

  if (profileRow?.must_change_password) {
    redirect(`/redefinir-senha?next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const locale = await getPlatformLocale();
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  await setLocaleCookie(locale);
  redirect(localeHomePath(locale));
}

export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = await getPlatformLocale();
  const messages = platformContent[locale].actions;
  if (!isSupabaseConfigured()) return { error: messages.platformUnavailable };

  const barrado = await barrarAbuso(formData, locale);
  if (barrado) return { error: barrado };

  const parsed = createForgotPasswordSchema(locale).safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? messages.invalidData };
  }

  const supabase = await createClient();
  const { siteUrl } = getSupabaseEnv();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/redefinir-senha")}`,
  });

  // Mensagem genérica de propósito: não revela se o e-mail existe na base
  // (evita enumeração de contas).
  return {
    success: messages.resetRequestSuccess,
  };
}

/**
 * Baixa a flag de senha temporária. Devolve `false` quando NÃO conseguiu —
 * inclusive no caso em que o UPDATE não encontra linha nenhuma, que o
 * PostgREST reporta sem erro algum (daí o `.select()`).
 *
 * Roda com o cliente de service role de propósito. `update
 * (must_change_password)` é revogado de `authenticated`: com o cliente
 * autenticado, o próprio aluno podia apagar a flag com um PATCH direto em
 * /rest/v1/profiles e ficar para sempre com a senha temporária que o
 * administrador conhece. Uma função `security definer` exposta a
 * `authenticated` reabriria o mesmo buraco — seria chamável sem trocar senha
 * nenhuma. Este cliente é server-only e o navegador não alcança.
 *
 * O `id` vem da SESSÃO (getUser), nunca do formulário: este cliente ignora
 * RLS, então quem escolhe a linha tem que ser o servidor.
 */
async function clearMustChangePassword(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    return !error && Boolean(data);
  } catch {
    // createAdminClient lança quando falta SUPABASE_SECRET_KEY, e a chamada
    // pode estourar por rede. Nos dois casos a flag continua de pé — é falha,
    // e quem chama precisa dizer isso a quem está na tela.
    return false;
  }
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = await getPlatformLocale();
  const messages = platformContent[locale].actions;
  if (!isSupabaseConfigured()) return { error: messages.platformUnavailable };

  const parsed = createResetPasswordSchema(locale).safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? messages.invalidData };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: messages.sessionExpired };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: messages.resetFailed };
  }

  /* ORDEM OBRIGATÓRIA: a flag só cai DEPOIS que o updateUser confirmou a troca.
   * Ao contrário, uma falha na troca deixaria a conta liberada ainda com a
   * senha temporária que o administrador conhece. */
  if (!(await clearMustChangePassword(user.id))) {
    // A senha JÁ mudou — dizer "não foi possível redefinir" aqui faria a
    // pessoa continuar usando a senha antiga, que não vale mais. O que
    // sobrou pendente é a flag: sem ela, /redefinir-senha volta a aparecer.
    return {
      error: messages.resetPartialFailure,
    };
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!roleRow?.role) {
    // Conta sem role não deveria existir (o trigger cria 'student'), mas
    // adivinhar uma área aqui seria pior do que parar.
    redirect("/acesso-negado");
  }

  redirect(resolvePostAuthDestination(readNext(formData), roleRow.role));
}
