import Link from "next/link";
import BrandLink from "@/components/BrandLink";
import { ArrowUpRight, Mail } from "@/components/icons";
import type { Locale, SiteContent } from "@/content/site";

/* min-h-9 dá 36px de alvo em listas densas; o sublinhado fica no <span>
   interno para continuar colado ao texto em vez de descer até a caixa. */
const columnLinkClasses =
  "group inline-flex min-h-9 items-center gap-2 text-[0.9375rem] text-ash " +
  "transition-colors duration-300 hover:text-white";

function FooterLink({
  href,
  label,
  external,
  externalLinkHint,
}: {
  href: string;
  label: string;
  external?: boolean;
  externalLinkHint: string;
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={columnLinkClasses}
      >
        <span className="link-underline">{label}</span>
        <ArrowUpRight className="h-3 w-3 shrink-0" />
        <span className="sr-only"> {externalLinkHint}</span>
      </a>
    );
  }
  return (
    <Link href={href} className={columnLinkClasses}>
      <span className="link-underline">{label}</span>
    </Link>
  );
}

export default function Footer({
  site,
  locale,
}: {
  site: SiteContent;
  locale: Locale;
}) {
  const { footer, brand } = site;
  const [navColumn, ...restColumns] = footer.columns;

  return (
    <footer className="bg-void">
      <div className="container-site pt-24 md:pt-32">
        <div className="flex flex-col gap-6 pb-14 md:flex-row md:items-center md:justify-between">
          {/* Mesmo componente do header: com nome acessível (antes o link do
              rodapé não tinha nenhum) e com o mesmo destino por idioma. Recebe
              duas strings, e não o `site` inteiro — BrandLink é Client
              Component; ver a nota em `headerContent` (site.ts). */}
          <BrandLink
            wordmark={brand.wordmark}
            tagline={site.meta.tagline}
            locale={locale}
            uid="ftr"
          />
          <p className="label-eyebrow text-ash">{brand.taglineInline}</p>
        </div>

        {/* Três colunas, mas só a primeira é landmark de navegação: o bloco de
            contato é informação institucional e não pertence a um <nav>.
            Títulos de coluna são <p>, não heading — a home já tem um h2 por
            seção e três h2 aqui embaixo bagunçariam o sumário da página. */}
        <div className="grid gap-12 border-t border-line pt-14 md:grid-cols-3 md:gap-8">
          <nav aria-label={site.a11y.footerNavLabel}>
            <p className="label-eyebrow text-ash">{navColumn.title}</p>
            <ul className="mt-5 space-y-1">
              {navColumn.links.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} externalLinkHint={site.a11y.externalLinkHint} />
                </li>
              ))}
            </ul>
          </nav>

          <address className="not-italic">
            <p className="label-eyebrow text-ash">{footer.contact.title}</p>
            <ul className="mt-5 space-y-1">
              <li>
                <a
                  href={`mailto:${footer.contact.email}`}
                  className={columnLinkClasses}
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="link-underline">{footer.contact.email}</span>
                </a>
              </li>
              {footer.contact.lines.map((line) => (
                <li key={line} className="py-1 text-[0.9375rem] text-ash">
                  {line}
                </li>
              ))}
            </ul>
          </address>

          {restColumns.map((column) => (
            <div key={column.title}>
              <p className="label-eyebrow text-ash">{column.title}</p>
              <ul aria-label={column.title} className="mt-5 space-y-1">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink {...link} externalLinkHint={site.a11y.externalLinkHint} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-2 border-t border-line pt-6 md:flex-row md:items-center md:justify-between md:gap-6">
          <p className="py-2 text-sm text-ash">{footer.copyright}</p>
          <ul className="flex flex-wrap items-center gap-x-6">
            {footer.legal.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="group inline-flex min-h-9 items-center text-sm text-ash transition-colors duration-300 hover:text-white"
                >
                  <span className="link-underline">{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/*
        A palavra gigante é elemento gráfico, não conteúdo: o nome da empresa já
        está na linha de copyright acima, lido por leitores de tela. O gradiente
        --royal → --violet a deixa propositalmente de baixo contraste — por isso
        aria-hidden. O overflow corta o pé das letras, como nas referências.
      */}
      <div className="container-site mt-16 overflow-hidden md:mt-20">
        <p
          aria-hidden="true"
          className="display t-wordmark wordmark-gradient translate-y-[0.09em] select-none whitespace-nowrap"
        >
          {footer.wordmark}
        </p>
      </div>
    </footer>
  );
}
