import type { Metadata } from "next";
import Link from "next/link";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthCard } from "@/components/platform/form";
import { ConfiguringNotice } from "@/components/platform/ConfiguringNotice";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { AuthPageShell } from "@/components/platform/AuthPageShell";
import { platformContent } from "@/content/platform";
import { getPlatformLocale } from "@/lib/i18n/locale";

export async function generateMetadata(): Promise<Metadata> {
  const content = platformContent[await getPlatformLocale()];
  return { title: content.auth.reset.metaTitle };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = await getPlatformLocale();
  const content = platformContent[locale];
  const copy = content.auth.reset;
  if (!isSupabaseConfigured()) {
    return (
      <AuthPageShell locale={locale} content={content}>
        <ConfiguringNotice content={content} locale={locale} />
      </AuthPageShell>
    );
  }

  const { next: nextParam } = await searchParams;

  /* Mesmo cuidado de /entrar: a ausência de `next` NÃO vira "/aluno" aqui.
   * Um administrador trocando a senha temporária cairia na área do aluno.
   * `resetPasswordAction` decide depois de ler a role. */
  const next = safeRedirectTarget(nextParam, "");

  // Precisa de uma sessão ativa — vem do link de e-mail (via /auth/callback)
  // ou de um login com must_change_password. Sem isso, não tem o que
  // redefinir.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthPageShell locale={locale} content={content}>
        <AuthCard title={copy.expiredTitle} subtitle={copy.expiredSubtitle}>
          <Link
            href="/recuperar-senha"
            className="inline-flex min-h-11 items-center font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold hover:text-gold-hi"
          >
            {copy.recoverPassword}
          </Link>
        </AuthCard>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell locale={locale} content={content}>
      <AuthCard title={copy.title} subtitle={copy.subtitle}>
        <ResetPasswordForm next={next} content={content} />
      </AuthCard>
    </AuthPageShell>
  );
}
