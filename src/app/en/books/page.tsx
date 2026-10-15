import type { Metadata } from "next";
import BooksPage from "@/components/pages/BooksPage";
import { siteContent } from "@/content/site";
import { getCatalogo, getCotacaoPublica } from "@/lib/dal/catalog";
import { notaDeConversao } from "@/lib/money";
import { buildPageMetadata } from "@/lib/metadata";

const site = siteContent.en;
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

export const metadata: Metadata = buildPageMetadata({
  site,
  locale: "en",
  key: "books",
  title: "Books",
  description: site.pages.books.lead,
});

export default async function Page() {
  /* Mesma consulta da versão em português, com o locale trocado: é ele que
     decide a sinopse e a moeda. Os títulos NÃO mudam — são os nomes oficiais
     das obras, e a nota que explica isso ao leitor de inglês vive em site.ts. */
  const [livros, taxa] = await Promise.all([getCatalogo("en"), getCotacaoPublica()]);

  /* A nota explica a conversão citando a cotação REAL. O texto vive em
     site.ts com um {rate}; o número vem do banco. */
  const priceNote = site.books.priceNote
    ? notaDeConversao(site.books.priceNote, taxa)
    : null;

  return <BooksPage site={site} locale="en" livros={livros} priceNote={priceNote} />;
}
