import { PlatformNav, type PlatformNavItem } from "@/components/platform/PlatformNav";
import {
  platformContent,
  type PlatformLocale,
  type PlatformShellLabels,
} from "@/content/platform";

export type { PlatformNavItem };

/**
 * Casca das duas áreas autenticadas (/aluno e /admin). Server Component: só
 * a navegação precisa de estado, e ela é o único Client Component daqui.
 *
 * A sidebar é `fixed`, então quem reserva a largura dela é o padding de
 * `#plataforma-conteudo` — definido em globals.css, e não aqui, porque ele
 * precisa reagir ao recolhimento (estado que vive no cliente, dentro de
 * PlatformNav, que marca `data-nav-collapsed` no <html>). Deixar o padding
 * fixo num valor só fazia a barra expandida cobrir o começo de cada linha.
 *
 * `id="plataforma-conteudo"` acumula duas funções: é o alvo desse padding e é
 * o que o drawer e os diálogos marcam com `inert` enquanto estão abertos.
 */
export function PlatformShell({
  areaLabel,
  homeHref,
  navItems,
  userName,
  userEmail,
  locale = "pt",
  labels,
  children,
}: {
  areaLabel: string;
  homeHref: string;
  navItems: PlatformNavItem[];
  userName: string;
  userEmail: string;
  locale?: PlatformLocale;
  labels?: PlatformShellLabels;
  children: React.ReactNode;
}) {
  const copy = labels ?? platformContent[locale].shell;

  return (
    <div className="min-h-screen bg-void">
      <a
        href="#conteudo-plataforma"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[3px] focus:bg-gold focus:px-5 focus:py-3 focus:font-sans focus:text-xs focus:font-medium focus:uppercase focus:tracking-[0.16em] focus:text-void"
      >
        {copy.skipToContent}
      </a>

      <PlatformNav
        areaLabel={areaLabel}
        homeHref={homeHref}
        navItems={navItems}
        userName={userName}
        userEmail={userEmail}
        locale={locale}
        labels={copy}
      />

      <div id="plataforma-conteudo">
        <main
          id="conteudo-plataforma"
          tabIndex={-1}
          className="panel-enter mx-auto w-full max-w-6xl px-4 py-8 focus:outline-none sm:px-6 md:py-12 lg:px-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
