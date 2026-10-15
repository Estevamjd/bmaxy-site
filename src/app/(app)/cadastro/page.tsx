import type { Metadata } from "next";
import { AuthCard, FormNotice } from "@/components/platform/form";
import { signupAvailable } from "@/lib/auth/signup-provider";
import { SignupForm } from "./SignupForm";
import { AuthPageShell } from "@/components/platform/AuthPageShell";
import { platformContent } from "@/content/platform";
import { getPlatformLocale } from "@/lib/i18n/locale";

export async function generateMetadata(): Promise<Metadata> {
  const content = platformContent[await getPlatformLocale()];
  return { title: content.auth.signup.metaTitle };
}

/**
 * `/cadastro`.
 *
 * A estrutura visual e o cadastro real usam o mesmo Server Action. Se as
 * variáveis do Supabase estiverem ausentes, a tela volta ao aviso seguro de
 * indisponibilidade sem fingir que criou uma conta.
 */
export default async function SignupPage() {
  const available = signupAvailable();
  const locale = await getPlatformLocale();
  const content = platformContent[locale];
  const copy = content.auth.signup;

  return (
    <AuthPageShell locale={locale} content={content} wide>
      <AuthCard
        title={copy.title}
        subtitle={copy.subtitle}
        width="wide"
      >
        {!available ? (
          <FormNotice>
            <p className="font-medium text-white">{copy.unavailableTitle}</p>
            <p className="mt-2">{copy.unavailableBody}</p>
          </FormNotice>
        ) : null}

        <SignupForm locale={locale} content={content} />
      </AuthCard>
    </AuthPageShell>
  );
}
