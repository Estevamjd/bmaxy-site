import type { Metadata } from "next";
import BooksPage from "@/components/pages/BooksPage";
import { siteContent } from "@/content/site";
import { getCatalogo, getCotacaoPublica } from "@/lib/dal/catalog";
import { notaDeConversao } from "@/lib/money";
import { buildPageMetadata } from "@/lib/metadata";

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

export const metadata: Metadata = buildPageMetadata({
  site,
  locale: "pt",
  key: "books",
  title: "Livros",
  description: site.pages.books.lead,
});

export default async function Page() {
  /* Os livros vêm do banco; o texto da seção continua em `site.ts`. A leitura
     é cacheada por tag e invalidada quando o painel salva, então a página
     continua estática entre uma alteração e outra. */
  const [livros, taxa] = await Promise.all([getCatalogo("pt"), getCotacaoPublica()]);

  /* A nota explica a conversão citando a cotação REAL. O texto vive em
     site.ts com um {rate}; o número vem do banco. */
  const priceNote = site.books.priceNote
    ? notaDeConversao(site.books.priceNote, taxa)
    : null;

  return <BooksPage site={site} locale="pt" livros={livros} priceNote={priceNote} />;
}
