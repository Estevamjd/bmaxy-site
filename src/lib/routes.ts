import type { Locale } from "@/content/site";

/**
 * =============================================================================
 *  MAPA DE ROTAS PÚBLICAS — pt (sem prefixo) / en (prefixo /en)
 * =============================================================================
 *
 *  Fonte única de verdade dos caminhos públicos. Existe porque três coisas
 *  diferentes precisam da MESMA tabela e não podem discordar entre si:
 *
 *    1. `site.ts` — os hrefs de menu, rodapé, cards e CTAs.
 *    2. `LanguageSwitch` — o botão PT/EN precisa levar à página EQUIVALENTE,
 *       não sempre para a home (era o comportamento antigo, de quando só a
 *       home existia nos dois idiomas).
 *    3. `metadata.ts` — canonical e hreflang de cada página.
 *
 *  Sem esta tabela, cada um teria a sua própria cópia de "/sobre vira
 *  /en/about" e um esqueceria de acompanhar o outro na primeira mudança.
 *
 *  Sem "server-only" de propósito: o Header e o LanguageSwitch são Client
 *  Components e importam daqui.
 * =========================================================================== */

/** Toda página pública que existe nos DOIS idiomas. */
export type PageKey =
  | "home"
  | "about"
  | "books"
  | "consulting"
  | "ghostwriting"
  | "course"
  | "terms"
  | "privacy";

const PAGE_PATHS: Record<PageKey, Record<Locale, string>> = {
  home: { pt: "/", en: "/en" },
  about: { pt: "/sobre", en: "/en/about" },
  books: { pt: "/livros", en: "/en/books" },
  consulting: { pt: "/consultoria", en: "/en/consulting" },
  ghostwriting: { pt: "/ghostwriting", en: "/en/ghostwriting" },
  course: { pt: "/curso", en: "/en/course" },
  // Jurídicas. Entraram na tabela quando deixaram de ser placeholder: sem
  // elas aqui, o botão PT/EN em /termos levava para a HOME em inglês, não
  // para /en/terms — exatamente o bug que esta tabela existe para evitar.
  // Não aparecem no menu (vivem no rodapé), mas o seletor de idioma e o
  // hreflang precisam conhecê-las.
  terms: { pt: "/termos", en: "/en/terms" },
  privacy: { pt: "/privacidade", en: "/en/privacy" },
};

/**
 * Os slugs de livro são os MESMOS nos dois idiomas de propósito: são nomes
 * próprios (títulos de obra), não frases traduzíveis, e manter um slug só
 * deixa o par pt/en de cada livro casar sozinho no hreflang.
 *
 * ---------------------------------------------------------------------------
 *  A LISTA FIXA DE SLUGS DEIXOU DE EXISTIR
 * ---------------------------------------------------------------------------
 *
 *  Havia aqui um `BOOK_SLUGS` com os seis títulos escritos à mão. Com o
 *  catálogo no banco, ele viraria a terceira fonte de verdade — e a que
 *  ninguém lembraria de atualizar. O sintoma seria discreto e feio: publicado
 *  um livro novo pelo painel, o botão PT/EN na página dele levaria para a HOME
 *  do outro idioma em vez da tradução, porque o slug não constaria da lista.
 *
 *  Este módulo é importado por Client Components (Header, LanguageSwitch) e
 *  portanto NÃO pode consultar o banco. A saída é não precisar da lista:
 *  qualquer caminho sob `/livros/` ou `/en/books/` tem equivalente no outro
 *  idioma, porque o slug é o mesmo dos dois lados. Se o livro não existir, quem
 *  responde 404 é a página de destino — que consulta o banco —, e não uma
 *  validação de formato feita aqui.
 *
 *  O formato ainda é conferido para o caminho não escapar da seção: barra ou
 *  ponto-ponto no meio virariam outra rota.
 */
export function isBookSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;
}

/** Caminho de uma página no idioma pedido. */
export function pagePath(key: PageKey, locale: Locale): string {
  return PAGE_PATHS[key][locale];
}

/** Caminho da página de um livro no idioma pedido. */
export function bookPath(slug: string, locale: Locale): string {
  return `${PAGE_PATHS.books[locale]}/${slug}`;
}

/**
 * Qual página está sendo servida por este caminho — usado pelo menu para
 * marcar o item atual com `aria-current="page"`. Compara com o caminho dos
 * DOIS idiomas: o mesmo menu roda em pt e en.
 *
 * A home é comparada por igualdade exata; as outras aceitam sub-rotas
 * (`/livros/aaron-tucker` continua sendo a seção "livros"), senão a página
 * de um livro deixaria o menu inteiro sem item ativo.
 */
export function pageKeyForPath(pathname: string): PageKey | null {
  const path = normalize(pathname);

  if (path === "/" || path === "/en") return "home";

  for (const key of Object.keys(PAGE_PATHS) as PageKey[]) {
    if (key === "home") continue;
    for (const locale of ["pt", "en"] as const) {
      const base = PAGE_PATHS[key][locale];
      if (path === base || path.startsWith(`${base}/`)) return key;
    }
  }

  return null;
}

/**
 * Caminho equivalente no outro idioma. Preserva a página (e o livro, quando
 * há um) em vez de jogar todo mundo na home. Cai na home do idioma de destino
 * quando não existe equivalente — é o caso das rotas da plataforma
 * (`/entrar`, `/aluno`, `/admin`), que hoje só existem em português.
 */
export function alternatePath(pathname: string, target: Locale): string {
  const path = normalize(pathname);

  // Página de livro: mantém o slug, troca só o prefixo do catálogo.
  for (const locale of ["pt", "en"] as const) {
    const base = PAGE_PATHS.books[locale];
    if (path.startsWith(`${base}/`)) {
      const slug = path.slice(base.length + 1);
      if (isBookSlug(slug)) return bookPath(slug, target);
    }
  }

  const key = pageKeyForPath(path);
  return key ? PAGE_PATHS[key][target] : PAGE_PATHS.home[target];
}

/** Remove a barra final ("/livros/" → "/livros"), preservando a raiz. */
function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}
