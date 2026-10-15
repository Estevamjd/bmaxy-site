import Link from "next/link";
import { AuthCard } from "@/components/platform/form";
import {
  platformContent,
  platformHomePath,
  type PlatformContent,
  type PlatformLocale,
} from "@/content/platform";

/**
 * Mostrada só nas rotas funcionais da plataforma quando o Supabase ainda
 * não tem as variáveis de ambiente configuradas — nunca na landing (/ e
 * /en continuam no ar normalmente independente disso).
 */
export function ConfiguringNotice({
  children,
  content = platformContent.pt,
  locale = "pt",
}: {
  children?: React.ReactNode;
  content?: PlatformContent;
  locale?: PlatformLocale;
}) {
  const copy = content.auth.configuring;
  return (
    <AuthCard title={copy.title} subtitle={copy.subtitle}>
      <p className="text-sm leading-relaxed text-ash">
        {copy.body}
      </p>
      {children}
      <Link
        href={platformHomePath(locale)}
        className="mt-6 inline-flex min-h-11 items-center font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold hover:text-gold-hi"
      >
        {content.common.backToSite}
      </Link>
    </AuthCard>
  );
}
