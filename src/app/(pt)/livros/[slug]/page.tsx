import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookDetailPage from "@/components/pages/BookDetailPage";
import { siteContent } from "@/content/site";
import { getCatalogo, getLivro, getSlugsPublicados, getCotacaoPublica } from "@/lib/dal/catalog";
import { notaDeConversao } from "@/lib/money";
import { buildBookMetadata } from "@/lib/metadata";

const site = siteContent.pt;
/**
 * Uma hora.
 *
 * O caminho normal de atualização é a revalidação por tag disparada quando o
 * painel salva — imediata, e é ela que faz a vitrine mudar em segundos. Este
 * intervalo é a REDE DE SEGURANÇA para os dois casos em que ninguém dispara
 * revalidação nenhuma:
 *
 *   - um build feito enquanto o Supabase estava fora do ar, que gerou a página
 *     vazia (ver `falhaDeLeitura` em src/lib/dal/catalog.ts);
 *   - uma alteração feita direto no banco, sem passar pelo painel.
 *
 * Sem ele, qualquer um dos dois só se corrigiria no próximo deploy.
 */
export const revalidate = 3600;

/** A lista vem do banco: quem define quais livros existem é o painel. */
export async function generateStaticParams() {
  const slugs = await getSlugsPublicados();
  return slugs.map((slug) => ({ slug }));
}

/**
 * `dynamicParams` era `false` e voltou ao padrão (`true`).
 *
 * Com o catálogo em arquivo, a lista de slugs era conhecida no build e um slug
 * fora dela não podia existir. Agora ela vem do banco: um livro publicado pelo
 * painel devolveria 404 até o próximo deploy — exatamente a "rota quebrada"
 * que o painel não deve conseguir criar.
 *
 * O 404 continua existindo para slug inexistente, só que decidido em runtime
 * pelo `notFound()` abaixo, contra o banco, e não pela ausência numa lista
 * fixada no build.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getLivro("pt", slug);
  if (!book) return {};

  return buildBookMetadata({
    site,
    locale: "pt",
    slug,
    title: book.title,
    description: `${site.pages.bookDetail.metaPrefix} ${book.synopsis}`,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [book, catalogo, taxa] = await Promise.all([
    getLivro("pt", slug),
    getCatalogo("pt"),
    getCotacaoPublica(),
  ]);
  if (!book) notFound();

  return (
    <BookDetailPage
      site={site}
      locale="pt"
      book={book}
      outros={catalogo.filter((item) => item.slug !== book.slug)}
      priceNote={
        site.books.priceNote ? notaDeConversao(site.books.priceNote, taxa) : null
      }
    />
  );
}
