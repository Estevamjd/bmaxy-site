import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Plus } from "@/components/icons";
import { PlusCorners, SectionEyebrow } from "@/components/ui";
import {
  bookPath,
  pagePath,
  type Locale,
  type SiteContent,
  type Link as SiteLink,
} from "@/content/site";
import { revealDelay } from "@/lib/reveal";
import type { LivroPublico } from "@/lib/dal/catalog";

/** Botão de loja. Sólido = a loja principal; contornado = a alternativa. */
function StoreButton({
  link,
  emphasis,
  externalLinkHint,
}: {
  link: SiteLink;
  emphasis: boolean;
  externalLinkHint: string;
}) {
  const skin = emphasis
    ? "bg-gold text-void hover:bg-gold-hi"
    : "border border-white/40 text-white hover:border-gold hover:text-gold";

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[2px] px-6 py-3.5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.14em] transition-colors duration-300 md:text-xs ${skin}`}
    >
      {link.label}
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
      <span className="sr-only"> {externalLinkHint}</span>
    </a>
  );
}

/**
 * `/livros/[slug]` e `/en/books/[slug]`.
 *
 * Sinopse, preços e links são exatamente os de `site.books.items` — o mesmo
 * material aprovado que já aparece na home e no catálogo. NENHUMA sinopse
 * nova foi escrita para esta página.
 *
 * O aviso de compra externa não é rodapé miúdo: fica antes dos botões, porque
 * os dois destinos levam para fora do site e a pessoa merece saber disso
 * antes de clicar, não depois.
 */
export default function BookDetailPage({
  site,
  locale,
  book,
  outros,
  priceNote,
}: {
  site: SiteContent;
  locale: Locale;
  book: LivroPublico;
  /** Os demais livros PUBLICADOS, para o rodapé de navegação. */
  outros: LivroPublico[];
  /** Já com a cotação real aplicada — ver notaDeConversao em lib/money.ts. */
  priceNote: string | null;
}) {
  const page = site.pages.bookDetail;
  const others = outros;

  return (
    <>
      <section className="bg-void pt-[128px] md:pt-[176px]">
        <div className="container-site">
          <nav aria-label={site.pages.common.breadcrumbLabel}>
            <Link
              href={pagePath("books", locale)}
              className="group inline-flex min-h-11 items-center gap-2 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ash transition-colors duration-300 hover:text-white"
            >
              <span aria-hidden="true">←</span>
              <span className="link-underline">{page.backToCatalog}</span>
            </Link>
          </nav>

          <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-16">
            {/* --------------------------- capa --------------------------- */}
            <div className="relative lg:col-span-5" data-reveal style={revealDelay(0)}>
              <PlusCorners tone="gold" />
              <div className="overflow-hidden bg-deep-surface">
                <Image
                  src={book.cover.src}
                  alt={book.cover.alt}
                  width={book.cover.width}
                  height={book.cover.height}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  priority
                  className="aspect-[2/3] w-full object-cover"
                />
              </div>
            </div>

            {/* -------------------------- conteúdo ------------------------ */}
            <div className="lg:col-span-6 lg:col-start-7">
              <SectionEyebrow label={page.eyebrow} />
              <h1 className="display t-section mt-6 text-white">{book.title}</h1>
              {page.titleNote ? (
                <p className="mt-3 text-sm leading-relaxed text-ash">{page.titleNote}</p>
              ) : null}

              <div className="mt-10 border-t border-line pt-8">
                <h2 className="label-eyebrow text-ash">{page.synopsisLabel}</h2>
                <p className="measure mt-5 text-[1.0625rem] leading-relaxed text-white/85 md:text-lg">
                  {book.synopsis}
                </p>
              </div>

              {/* Preços só aparecem quando existem no catálogo. "Respeito de
                  Daniel" não tem nenhum dos dois — e nesse caso o bloco some
                  inteiro, em vez de mostrar um traço ou "sob consulta". */}
              {book.price || book.ebookPrice ? (
                <div className="mt-10 border-t border-line pt-8">
                  <h2 className="label-eyebrow text-ash">{page.pricesLabel}</h2>
                  <dl className="mt-5 flex flex-wrap items-baseline gap-x-10 gap-y-3">
                    {book.price ? (
                      <div>
                        <dt className="label-eyebrow text-ash">
                          {site.books.priceLabels.print}
                        </dt>
                        <dd className="display mt-2 text-[1.75rem] text-white">
                          {book.price}
                        </dd>
                      </div>
                    ) : null}
                    {book.ebookPrice ? (
                      <div>
                        <dt className="label-eyebrow text-gold">
                          {site.books.priceLabels.ebook}
                        </dt>
                        <dd className="display mt-2 text-[1.75rem] text-white">
                          {book.ebookPrice}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {priceNote ? (
                    <p className="measure mt-5 text-sm leading-relaxed text-ash">
                      {priceNote}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-10 border-t border-line pt-8">
                <h2 className="label-eyebrow text-ash">{page.whereToBuyLabel}</h2>

                <p className="measure mt-5 flex items-start gap-3 text-[0.9375rem] leading-relaxed text-ash">
                  <Plus className="mt-1.5 h-3 w-3 shrink-0 text-gold" />
                  <span>{page.externalNotice}</span>
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <StoreButton
                    link={book.links.amazon}
                    emphasis
                    externalLinkHint={site.a11y.externalLinkHint}
                  />
                  <StoreButton
                    link={book.links.clubeDeAutores}
                    emphasis={false}
                    externalLinkHint={site.a11y.externalLinkHint}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- outros livros -------------------------- */}
      <section className="section-y bg-void">
        <div className="container-site">
          <SectionEyebrow as="h2" label={page.otherBooksLabel} />

          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:mt-14 md:grid-cols-5 md:gap-x-8">
            {others.map((other, index) => (
              <li key={other.slug} data-reveal style={revealDelay(index, 60)}>
                <Link href={bookPath(other.slug, locale)} className="group block">
                  <div className="overflow-hidden bg-deep-surface">
                    <Image
                      src={other.cover.src}
                      alt={other.cover.alt}
                      width={other.cover.width}
                      height={other.cover.height}
                      sizes="(min-width: 768px) 18vw, 45vw"
                      className="aspect-[2/3] w-full object-cover transition-transform duration-[900ms] ease-out-expo group-hover:scale-[1.04]"
                    />
                  </div>
                  <p className="display mt-4 text-[1rem] leading-tight text-white transition-colors duration-300 group-hover:text-gold">
                    <span className="link-underline">{other.title}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
