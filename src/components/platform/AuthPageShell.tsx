import { LocaleSwitcher } from "@/components/platform/LocaleSwitcher";
import type { PlatformContent, PlatformLocale } from "@/content/platform";

export function AuthPageShell({
  locale,
  content,
  wide = false,
  children,
}: {
  locale: PlatformLocale;
  content: PlatformContent;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>
        <LocaleSwitcher locale={locale} labels={content.localeSwitch} />
        {children}
      </div>
    </main>
  );
}
