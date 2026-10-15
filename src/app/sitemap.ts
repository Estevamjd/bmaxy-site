import type { MetadataRoute } from "next";
import { siteContent } from "@/content/site";
import { getSlugsPublicados } from "@/lib/dal/catalog";
import { bookPath, pagePath, type PageKey } from "@/lib/routes";

/**
 * =============================================================================
 *  SITEMAP
 * =============================================================================
 *
 *  Gerado a partir de `src/lib/routes.ts`, a mesma tabela que o menu, o
 *  seletor de idioma e o hreflang usam. Não existe lista de URLs escrita à
 *  mão aqui de propósito: uma segunda lista sempre acaba discordando da
 *  primeira, e um sitemap que aponta para rota inexistente é pior do que não
 *  ter sitemap.
 *
 *  CADA URL DECLARA O PAR pt/en. É a mesma informação do `hreflang` das
 *  páginas, repetida aqui porque o Google trata as duas fontes de forma
 *  independente — e, sem isso, `/sobre` e `/en/about` competem entre si em
 *  vez de serem lidas como traduções da mesma página.
 *
 *  FICAM DE FORA, e não é esquecimento: `/entrar`, `/cadastro`,
 *  `/recuperar-senha`, `/redefinir-senha`, `/aluno/**`, `/admin/**` e
 *  `/auth/callback`. São rotas de sessão ou de formulário; indexá-las não
 *  traz ninguém e expõe superfície à toa. O `robots.ts` também as bloqueia —
 *  as duas coisas se reforçam.
 * =========================================================================== */

/** Páginas que existem nos DOIS idiomas e devem ser indexadas. */
const PAGINAS: { key: PageKey; prioridade: number }[] = [
  { key: "home", prioridade: 1 },
  { key: "books", prioridade: 0.9 },
  { key: "course", prioridade: 0.9 },
  { key: "about", prioridade: 0.8 },
  { key: "consulting", prioridade: 0.8 },
  { key: "ghostwriting", prioridade: 0.8 },
  // Jurídicas: indexáveis desde que deixaram de ser placeholder, mas com
  // prioridade baixa — ninguém chega ao site procurando os Termos.
  { key: "terms", prioridade: 0.3 },
  { key: "privacy", prioridade: 0.3 },
];

/** Uma casa decimal, que é toda a precisão que `<priority>` admite. */
function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteContent.pt.meta.url.replace(/\/$/, "");
  const url = (caminho: string) => `${base}${caminho === "/" ? "" : caminho}`;

  /* A data vem do build. Não é `new Date()` a cada requisição: o sitemap é
     estático, e um lastModified que muda sozinho todo dia ensina o
     rastreador a ignorar o campo. */
  const atualizadoEm = new Date();

  const entradas: MetadataRoute.Sitemap = [];

  for (const { key, prioridade } of PAGINAS) {
    const pt = pagePath(key, "pt");
    const en = pagePath(key, "en");

    for (const [locale, caminho] of [
      ["pt", pt],
      ["en", en],
    ] as const) {
      entradas.push({
        url: url(caminho),
        lastModified: atualizadoEm,
        changeFrequency: key === "home" ? "weekly" : "monthly",
        /* A versão em português é a principal: é ela que vive na raiz.
         *
         * O arredondamento não é preciosismo. `0.8 - 0.1` em ponto flutuante
         * dá 0.7000000000000001, e `0.3 - 0.1` dá 0.19999999999999998 — e era
         * exatamente isso que estava saindo no XML. Nenhum rastreador se
         * importa com a diferença, mas um sitemap com dezessete casas decimais
         * denuncia que ninguém olhou o arquivo gerado. */
        priority:
          locale === "pt" ? prioridade : Math.max(arredondar(prioridade - 0.1), 0.1),
        alternates: {
          languages: {
            "pt-BR": url(pt),
            "en-US": url(en),
          },
        },
      });
    }
  }

  /* Os slugs de livro são os MESMOS nos dois idiomas — são nomes próprios,
     não frases traduzíveis.
     
     A lista vem do BANCO, e só com os livros PUBLICADOS. Era uma constante
     escrita à mão; com o catálogo administrável, uma lista fixa mandaria o
     rastreador para a página de um livro arquivado (404) e esconderia um
     livro recém-publicado. */
  for (const slug of await getSlugsPublicados()) {
    const pt = bookPath(slug, "pt");
    const en = bookPath(slug, "en");

    for (const caminho of [pt, en]) {
      entradas.push({
        url: url(caminho),
        lastModified: atualizadoEm,
        changeFrequency: "monthly",
        priority: 0.7,
        alternates: {
          languages: {
            "pt-BR": url(pt),
            "en-US": url(en),
          },
        },
      });
    }
  }

  return entradas;
}
