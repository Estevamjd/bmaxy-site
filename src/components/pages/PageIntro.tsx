import Link from "next/link";
import { SectionEyebrow } from "@/components/ui";
import { pagePath } from "@/lib/routes";
import type { Locale, SiteContent } from "@/content/site";

/**
 * Topo padrão de toda página interna: caminho de volta, etiqueta, h1 e
 * parágrafo de abertura. Uma peça só para as cinco páginas — se o espaçamento
 * do topo mudar, muda em todas de uma vez.
 *
 * O padding superior existe porque o header é `fixed`: sem ele o h1 nasceria
 * debaixo da barra. Os valores acompanham a altura real do header
 * (72px no mobile, 96px a partir de md) mais o respiro da seção.
 */
export default function PageIntro({
  site,
  locale,
  eyebrow,
  title,
  lead,
  children,
}: {
  site: SiteContent;
  locale: Locale;
  eyebrow: string;
  title: string;
  lead: string;
  /** Ações opcionais logo abaixo do parágrafo (botões, links). */
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-void pb-4 pt-[128px] md:pb-8 md:pt-[176px]">
      <div className="container-site">
        {/* Volta explícita para a home. Não é migalha de pão completa: a
            hierarquia do site tem um nível só, e uma trilha de dois itens
            seria mais decoração do que ajuda. */}
        <nav aria-label={site.pages.common.breadcrumbLabel}>
          <Link
            href={pagePath("home", locale)}
            className="group inline-flex min-h-11 items-center gap-2 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ash transition-colors duration-300 hover:text-white"
          >
            <span aria-hidden="true">←</span>
            <span className="link-underline">{site.pages.common.backToHome}</span>
          </Link>
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="lg:col-span-7">
            <SectionEyebrow label={eyebrow} />
            <h1 className="display t-section mt-6 text-white">{title}</h1>
          </div>
          <p className="measure text-[1.0625rem] leading-relaxed text-ash lg:col-span-5 lg:pb-3 md:text-lg">
            {lead}
          </p>
        </div>

        {children ? <div className="mt-10 md:mt-12">{children}</div> : null}
      </div>
    </section>
  );
}
