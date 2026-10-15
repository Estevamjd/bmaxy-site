import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Plus } from "@/components/icons";
import PageIntro from "@/components/pages/PageIntro";
import { bookPath, type Locale, type SiteContent } from "@/content/site";
import type { LivroPublico } from "@/lib/dal/catalog";
import { revealDelay } from "@/lib/reveal";

/**
 * `/livros` e `/en/books` — catálogo completo, na ordem aprovada pelo
 * cliente (a mesma de `site.books.items`; não reordenar).
 *
 * CAPA E TÍTULO SÃO O MESMO LINK, para a página do livro. Os botões de loja
 * NÃO se repetem aqui de propósito: um card com três links concorrentes
 * (página, Amazon, Clube de Autores) faz a pessoa escolher errado. Aqui o
 * card leva à página do livro; é lá que ela decide onde comprar, já com o
 * aviso de que a compra acontece fora do site.
 */
export default function BooksPage({
  site,
  locale,
  livros,
  priceNote,
}: {
  site: SiteContent;
  locale: Locale;
  /** Vêm do banco, já formatados no idioma e na ordem definida no painel. */
  livros: LivroPublico[];
  /** Já com a cotação real aplicada — ver notaDeConversao em lib/money.ts. */
  priceNote: string | null;
}) {
  const page = site.pages.books;
  const { books } = site;

  return (
    <>
      <PageIntro
        site={site}
        locale={locale}
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.lead}
      />

      <section className="section-y bg-bone pt-16 text-ink md:pt-20">
        <div className="container-site">
          {/* Onde cada formato é comprado — precisa ficar explícito. */}
          <p className="flex items-start gap-3 border-t border-line-light pt-6 text-sm text-ink-soft">
            <Plus className="mt-1 h-3 w-3 shrink-0 text-royal" />
            <span className="measure">{books.note}</span>
          </p>

          {books.titleNote || priceNote ? (
            <div className="mt-4 space-y-1 pl-6 text-xs leading-relaxed text-ink-soft">
              {books.titleNote ? <p>{books.titleNote}</p> : null}
              {priceNote ? <p>{priceNote}</p> : null}
            </div>
          ) : null}

          <ul className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-x-10">
            {livros.map((book, index) => (
              <li
                key={book.slug}
                data-reveal
                style={revealDelay(index % 3)}
                className="flex flex-col"
              >
                {/* Um <Link> só envolvendo capa e título: dois links vizinhos
                    para o mesmo destino viram dois itens repetidos na
                    navegação por links do leitor de tela. */}
                <Link href={bookPath(book.slug, locale)} className="group flex flex-col">
                  <div className="overflow-hidden bg-line-light">
                    <Image
                      src={book.cover.src}
                      alt={book.cover.alt}
                      width={book.cover.width}
                      height={book.cover.height}
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                      /* Só a PRIMEIRA capa é prioritária (preload +
                         fetchpriority alto). Marcar as seis anularia o ganho:
                         tudo prioritário é o mesmo que nada.

                         Mas a primeira LINHA inteira nasce dentro da dobra
                         acima de 640px — medido: em 1440x900 as três primeiras
                         capas ficam com o topo em 609px, e em 768x1024 as duas
                         primeiras em 687px. Como `priority` não varia por
                         breakpoint, as outras duas ganham loading="eager": não
                         preloadam nem sobem de prioridade, só deixam de ser
                         adiadas. Em 390px isso custa duas imagens carregadas
                         uma tela antes do necessário; em troca, no desktop as
                         capas visíveis param de entrar por último.

                         LIMITAÇÃO ACEITA: em 1024px+ o elemento de LCP pode
                         ser a 2ª ou a 3ª capa (as três têm o mesmo tamanho), e
                         aí o Next avisa em dev "add priority" apontando para
                         ela. Prioritizar as três silenciaria o aviso, mas
                         faria o celular pré-carregar duas imagens que estão
                         uma tela abaixo da dobra — o oposto do que priority
                         existe para fazer. Preferimos o aviso de dev. */
                      priority={index === 0}
                      loading={index === 0 ? undefined : index < 3 ? "eager" : "lazy"}
                      className="aspect-[2/3] w-full object-cover transition-transform duration-[900ms] ease-out-expo group-hover:scale-[1.04]"
                    />
                  </div>

                  <h2 className="display mt-7 text-[1.375rem] leading-[1.02] text-ink transition-colors duration-300 group-hover:text-royal md:text-[1.5rem]">
                    <span className="link-underline">{book.title}</span>
                  </h2>
                </Link>

                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                  {book.synopsis}
                </p>

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

                {/* mt-auto empurra o CTA para a base do card: as três colunas
                    alinham mesmo com sinopses de alturas diferentes. */}
                <div className="mt-auto pt-6">
                  <Link
                    href={bookPath(book.slug, locale)}
                    aria-label={`${page.detailCta}: ${book.title}`}
                    className="group inline-flex min-h-11 items-center gap-2 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:text-royal md:text-xs"
                  >
                    <span className="link-underline">{page.detailCta}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 rotate-45" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
