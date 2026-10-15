import type { Metadata } from "next";
import { logoutAction } from "@/lib/actions/auth";
import { AuthCard } from "@/components/platform/form";
import { AuthPageShell } from "@/components/platform/AuthPageShell";
import { platformContent } from "@/content/platform";
import { getPlatformLocale } from "@/lib/i18n/locale";

export async function generateMetadata(): Promise<Metadata> {
  const content = platformContent[await getPlatformLocale()];
  return { title: content.auth.denied.metaTitle };
}

/**
 * Rota de destino para uma conta autenticada mas sem role reconhecida
 * (student/admin) em user_roles — não deveria acontecer, dado o trigger em
 * auth.users, mas é tratada com segurança em vez de deixar a pessoa cair em
 * alguma área por engano. Não revela detalhes internos, só orienta a
 * contatar o administrador.
 */
export default async function AccessDeniedPage() {
  const locale = await getPlatformLocale();
  const content = platformContent[locale];
  const copy = content.auth.denied;
  return (
    <AuthPageShell locale={locale} content={content}>
      <AuthCard
        title={copy.title}
        subtitle={copy.subtitle}
      >
        <p className="text-sm leading-relaxed text-ash">{copy.body}</p>
        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold hover:text-gold-hi"
          >
            {copy.logOut}
          </button>
        </form>
      </AuthCard>
    </AuthPageShell>
  );
}
