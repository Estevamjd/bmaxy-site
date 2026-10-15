import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/auth/roles";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthCard } from "@/components/platform/form";
import { ErrorNotice } from "@/components/platform/ui";
import { ConfiguringNotice } from "@/components/platform/ConfiguringNotice";
import { AuthPageShell } from "@/components/platform/AuthPageShell";
import { platformContent } from "@/content/platform";
import { getPlatformLocale } from "@/lib/i18n/locale";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const content = platformContent[await getPlatformLocale()];
  return { title: content.auth.login.metaTitle };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next: nextParam, erro } = await searchParams;
  const locale = await getPlatformLocale();
  const content = platformContent[locale];
  const copy = content.auth.login;

  if (!isSupabaseConfigured()) {
    // Mesmo sem login funcionando, o caminho para o cadastro precisa existir
    // aqui: /cadastro tem o próprio aviso honesto e é onde a pessoa vê o que
    // vai acontecer quando a plataforma entrar no ar.
    return (
      <AuthPageShell locale={locale} content={content}>
        <ConfiguringNotice content={content} locale={locale}>
          <p className="mt-4 border-t border-line pt-4 text-sm text-ash">
            {copy.noAccount}{" "}
            <Link href="/cadastro" className="text-gold hover:text-gold-hi">
              {copy.createAccount}
            </Link>
          </p>
        </ConfiguringNotice>
      </AuthPageShell>
    );
  }

  // Já logado? Manda direto pra área certa em vez de mostrar o formulário.
  const auth = await getAuthContext();
  if (auth?.role) {
    redirect(homePathForRole(auth.role));
  }

  /* O destino NÃO é decidido aqui. Antes, esta linha era
   *   safeRedirectTarget(nextParam, "/aluno")
   * — ou seja, a ausência de `?next` virava "/aluno" ANTES de existir sessão
   * e antes de qualquer role ser lida. Um administrador logando pela rota
   * simples ia parar na área do aluno por causa deste padrão.
   *
   * Agora a página só higieniza contra redirecionamento aberto e repassa o
   * valor cru (string vazia quando não há nada aproveitável). Quem decide é
   * `loginAction`, DEPOIS de consultar public.user_roles. */
  const next = safeRedirectTarget(nextParam, "");

  /* /auth/callback manda para cá com `erro=link-invalido` quando a troca do
   * código falha — link expirado, já usado, ou aberto num navegador diferente
   * daquele que pediu a recuperação. Sem esta mensagem a pessoa cai num
   * formulário de login em branco, sem nenhuma pista do que aconteceu.
   *
   * A lista é fechada de propósito: o valor vem da query string, e ecoar texto
   * de lá na tela seria deixar terceiro escrever na nossa interface. */
  const aviso =
    erro === "link-invalido"
      ? copy.invalidLink
      : null;

  return (
    <AuthPageShell locale={locale} content={content}>
      <AuthCard title={copy.title} subtitle={copy.subtitle}>
        {aviso ? (
          <div className="mb-6">
            <ErrorNotice message={aviso} />
          </div>
        ) : null}
        <LoginForm next={next} locale={locale} content={content} />
      </AuthCard>
    </AuthPageShell>
  );
}
