import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthCard } from "@/components/platform/form";
import { ConfiguringNotice } from "@/components/platform/ConfiguringNotice";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { AuthPageShell } from "@/components/platform/AuthPageShell";
import { platformContent } from "@/content/platform";
import { getPlatformLocale } from "@/lib/i18n/locale";

export async function generateMetadata(): Promise<Metadata> {
  const content = platformContent[await getPlatformLocale()];
  return { title: content.auth.forgot.metaTitle };
}

export default async function ForgotPasswordPage() {
  const locale = await getPlatformLocale();
  const content = platformContent[locale];
  const copy = content.auth.forgot;
  if (!isSupabaseConfigured()) {
    return (
      <AuthPageShell locale={locale} content={content}>
        <ConfiguringNotice content={content} locale={locale} />
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell locale={locale} content={content}>
      <AuthCard
        title={copy.title}
        subtitle={copy.subtitle}
      >
        <ForgotPasswordForm locale={locale} content={content} />
      </AuthCard>
    </AuthPageShell>
  );
}
