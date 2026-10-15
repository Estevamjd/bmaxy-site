import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Plus } from "@/components/icons";
import { ButtonGhost, SectionEyebrow } from "@/components/ui";
import type { SiteContent, Link as SiteLink } from "@/content/site";
import type { LivroPublico } from "@/lib/dal/catalog";
import { revealDelay } from "@/lib/reveal";

/** Botãozinho de loja. Sólido em --gold = compra aqui; contornado = sai do site. */
function StoreLink({
  link,
  emphasis = false,
  externalLinkHint,
}: {
  link: SiteLink;
  emphasis?: boolean;
  externalLinkHint: string;
}) {
  const classes =
    "inline-flex min-h-11 items-center gap-1.5 rounded-[2px] px-4 font-sans " +
    "text-[0.6875rem] font-medium uppercase tracking-[0.12em] transition-colors duration-300 " +
    (emphasis
      ? "bg-gold text-void hover:bg-gold-hi"
      : "border border-ink/50 text-ink-soft hover:border-royal hover:text-royal");

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {link.label}
        <ArrowUpRight className="h-3 w-3 shrink-0" />
        <span className="sr-only"> {externalLinkHint}</span>
      </a>
    );
  }

  return (
    <Link href={link.href} className={classes}>
      {link.label}
    </Link>
  );
}

/**
 * Os livros chegam por PROP, não de `site.books.items`.
 *
 * O catálogo passou a viver no banco, e o texto da seção (título, chamada,
 * nota de compra) continua em `site.ts` — são coisas de naturezas diferentes:
 * uma o administrador edita no painel, a outra é copy do site. A prop deixa
 * essa divisão explícita em vez de escondê-la dentro do componente.
 */
export default function Books({
  site,
  livros,
}: {
  site: SiteContent;
  livros: LivroPublico[];
}) {
  const { books } = site;

  return (
    <section id="livros" className="section-y bg-bone text-ink">
      <div className="container-site">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="lg:col-span-7">
            <SectionEyebrow index={books.index} label={books.label} tone="light" />
            <h2 className="display t-section mt-6 text-ink">{books.title}</h2>
          </div>
          <p className="measure text-[1.0625rem] leading-relaxed text-ink-soft lg:col-span-5 lg:pb-3">
            {books.intro}
          </p>
        </div>

        {/* Onde cada formato é comprado — precisa ficar explícito */}
        <p className="mt-10 flex items-start gap-3 border-t border-line-light pt-6 text-sm text-ink-soft md:mt-12">
          <Plus className="mt-1 h-3 w-3 shrink-0 text-royal" />
          <span className="measure">{books.note}</span>
        </p>

        <ul className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-x-10">
          {livros.map((book, index) => (
            <li
              key={book.title}
              data-reveal
              style={revealDelay(index % 3)}
              className="group flex flex-col"
            >
              <div className="overflow-hidden bg-line-light">
                <Image
                  src={book.cover.src}
                  alt={book.cover.alt}
                  width={book.cover.width}
                  height={book.cover.height}
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                  className="aspect-[2/3] w-full object-cover transition-transform duration-[900ms] ease-out-expo group-hover:scale-[1.04]"
                />
              </div>

              <h3 className="display mt-7 text-[1.375rem] leading-[1.02] text-ink md:text-[1.5rem]">
                {book.title}
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                {book.synopsis}
              </p>

              {/* Preços só aparecem quando existem no catálogo. O `mt-auto`
                  empurra preço e botões para a base do card, para as três
                  colunas alinharem mesmo com sinopses de alturas diferentes. */}
              {book.price || book.ebookPrice ? (
                <dl className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                  {book.price ? (
                    <div className="flex items-baseline gap-2">
                      <dt className="label-eyebrow text-ink-soft">
                        {books.priceLabels.print}
                      </dt>
                      <dd className="text-[0.9375rem] font-medium text-ink">
                        {book.price}
                      </dd>
                    </div>
                  ) : null}
                  {book.ebookPrice ? (
                    <div className="flex items-baseline gap-2">
                      <dt className="label-eyebrow text-royal">
                        {books.priceLabels.ebook}
                      </dt>
                      <dd className="text-[0.9375rem] font-medium text-ink">
                        {book.ebookPrice}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {/* aria-label na lista em vez de um <span class="sr-only"> solto:
                  assim o rótulo sobrevive à navegação por links. */}
              <ul
                aria-label={`${books.formatsLabel} — ${book.title}`}
                className="mt-auto flex flex-wrap items-center gap-2 pt-6"
              >
                <li>
                  <StoreLink
                    link={book.links.amazon}
                    externalLinkHint={site.a11y.externalLinkHint}
                  />
                </li>
                <li>
                  <StoreLink
                    link={book.links.clubeDeAutores}
                    externalLinkHint={site.a11y.externalLinkHint}
                  />
                </li>
              </ul>
            </li>
          ))}
        </ul>

        <div className="mt-16 flex justify-start border-t border-line-light pt-10 md:mt-20">
          <ButtonGhost href={books.allBooks.href} tone="light">
            {books.allBooks.label}
          </ButtonGhost>
        </div>
      </div>
    </section>
  );
}
