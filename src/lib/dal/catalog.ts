import "server-only";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookStatus, BookStore, Database } from "@/lib/supabase/types";
import {
  TAXA_PADRAO,
  formatarPreco,
  taxaDeTexto,
  type Taxa,
} from "@/lib/money";
import type { Locale } from "@/content/site";

/**
 * =============================================================================
 *  CATÁLOGO — leitura
 * =============================================================================
 *
 *  A vitrine e o painel leem por caminhos DIFERENTES de propósito:
 *
 *    vitrine → createPublicClient()  → sem cookie, sem sessão, atendido como
 *                                      `anon`, cacheado por tag
 *    painel  → createClient()        → sessão do administrador, sempre fresco
 *
 *  Não é duplicação. A vitrine não deve enxergar rascunho nem por engano, e a
 *  única forma de garantir isso sem depender de o código lembrar de filtrar é
 *  falar com o banco como um desconhecido fala. O `status = 'published'` que
 *  aparece nas consultas públicas abaixo é conforto de leitura; quem garante
 *  é a policy `books_select_anon`.
 *
 *  O painel, no oposto, precisa ver rascunho e arquivado — e por isso NÃO
 *  passa pelo cache. Um administrador que salva e não vê a mudança perde a
 *  confiança na ferramenta em dois minutos.
 * =========================================================================== */

/* -------------------------------------------------------------------------- */
/*  Tags de cache                                                              */
/* -------------------------------------------------------------------------- */

/** Tudo que lista livros: os dois catálogos e o sitemap. */
export const TAG_CATALOGO = "catalogo";

/** A página de UM livro. Existe para que salvar um livro não derrube os seis. */
export const tagLivro = (slug: string) => `livro:${slug}`;

/* -------------------------------------------------------------------------- */
/*  A forma que a vitrine consome                                              */
/* -------------------------------------------------------------------------- */

/**
 * Igual ao item que vivia em `site.ts`, campo por campo.
 *
 * É intencional: `BooksPage` e `BookDetailPage` continuam recebendo o que
 * sempre receberam, e a troca de arquivo por banco não passa por eles. Um
 * redesenho da vitrine junto com a troca da fonte de dados dobraria a
 * superfície de erro e deixaria "quebrou o layout" e "quebrou a consulta"
 * indistinguíveis.
 */
export type LivroPublico = {
  slug: string;
  title: string;
  synopsis: string;
  /** Já formatado no idioma do leitor. `null` = este formato não tem preço. */
  price: string | null;
  ebookPrice: string | null;
  cover: { src: string; alt: string; width: number; height: number };
  links: {
    amazon: { label: string; href: string; external: true };
    clubeDeAutores: { label: string; href: string; external: true };
  };
};

/**
 * Os rótulos das lojas são TEXTO DE INTERFACE, não dado do livro — por isso
 * vivem aqui e não numa coluna. "(EUA)" e "(US)" são a mesma informação em
 * dois idiomas; guardá-la no banco criaria uma tradução que o administrador
 * teria de manter à mão em cada livro, seis vezes a mesma coisa.
 */
const ROTULOS_LOJA: Record<Locale, Record<BookStore, string>> = {
  pt: { amazon: "Amazon (EUA)", clube_de_autores: "Clube de Autores (BR)" },
  en: { amazon: "Amazon (US)", clube_de_autores: "Clube de Autores (Brazil)" },
};

/** Dimensões usadas quando a capa não declara as suas. Proporção A4, como as seis atuais. */
const CAPA_LARGURA_PADRAO = 1654;
const CAPA_ALTURA_PADRAO = 2480;

/** O bucket criado em 20260806054248_book_catalog_operations_and_covers. */
export const BUCKET_CAPAS = "book-covers";

/**
 * `cover_path` guarda uma de DUAS coisas, e a barra inicial é o que separa:
 *
 *   "/livros/aaron-tucker.jpg"  → arquivo em `public/`, servido pelo próprio
 *                                 Next. É o que os seis livros migrados usam.
 *   "capas/<uuid>.jpg"          → objeto no Storage, enviado pelo painel.
 *
 * Guardar a URL completa do Storage na coluna seria pior: a URL contém o
 * subdomínio do projeto Supabase, e trocar de projeto (ou restaurar um backup
 * noutro) transformaria seis capas em links quebrados apontando para um
 * projeto que não é mais o nosso. O caminho relativo sobrevive à mudança.
 */
function urlDaCapa(coverPath: string): string {
  if (coverPath === "") return "";
  if (coverPath.startsWith("/")) return coverPath;

  const { url } = getSupabaseEnv();
  return `${url}/storage/v1/object/public/${BUCKET_CAPAS}/${coverPath}`;
}

/* -------------------------------------------------------------------------- */
/*  Consultas                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `!inner` não é usado: um livro sem a linha de localização de um idioma
 * DESAPARECERIA da vitrine daquele idioma, silenciosamente. Com o join à
 * esquerda ele aparece com sinopse vazia — visível, corrigível, e não um
 * livro que some sem ninguém entender por quê.
 */
const SELECAO = `
  slug, title, status, order_index,
  print_price_cents, ebook_price_cents,
  cover_path, cover_width, cover_height,
  book_localizations ( locale, synopsis, cover_alt ),
  book_store_links ( store, url )
` as const;

type LinhaCatalogo = {
  slug: string;
  title: string;
  status: BookStatus;
  order_index: number;
  print_price_cents: number | null;
  ebook_price_cents: number | null;
  cover_path: string;
  cover_width: number | null;
  cover_height: number | null;
  book_localizations: { locale: string; synopsis: string; cover_alt: string }[];
  book_store_links: { store: string; url: string }[];
};

function montarLivro(linha: LinhaCatalogo, locale: Locale, taxa: Taxa): LivroPublico {
  const loc = linha.book_localizations.find((l) => l.locale === locale);
  const link = (loja: BookStore) => {
    const encontrado = linha.book_store_links.find((l) => l.store === loja);
    return {
      label: ROTULOS_LOJA[locale][loja],
      /* Sem link cadastrado, o botão aponta para a própria página do livro em
         vez de para "#" ou para uma URL inventada. Não leva a lugar nenhum
         novo, e não promete uma loja que não existe. */
      href: encontrado?.url ?? "",
      external: true as const,
    };
  };

  return {
    slug: linha.slug,
    title: linha.title,
    synopsis: loc?.synopsis ?? "",
    price: formatarPreco(linha.print_price_cents, locale, taxa),
    ebookPrice: formatarPreco(linha.ebook_price_cents, locale, taxa),
    cover: {
      src: urlDaCapa(linha.cover_path),
      alt: loc?.cover_alt ?? linha.title,
      width: linha.cover_width ?? CAPA_LARGURA_PADRAO,
      height: linha.cover_height ?? CAPA_ALTURA_PADRAO,
    },
    links: { amazon: link("amazon"), clubeDeAutores: link("clube_de_autores") },
  };
}

/**
 * A cotação, exata.
 *
 * `brl_per_usd::text` e não `brl_per_usd`: o PostgREST serializa `numeric`
 * como número JSON, e `5.1000` viraria o `double` mais próximo de 5.1 — que
 * não é 5.1 — antes de `taxaDeTexto()` ter chance de opinar. O cast mantém o
 * decimal em texto do banco até o parser.
 *
 * Sem a linha ou com valor ilegível, cai na cotação combinada com o cliente em
 * vez de propagar o erro: o catálogo em português não depende dela, e uma
 * página inteira fora do ar por causa da conversão aproximada em inglês seria
 * uma troca ruim. É o único fallback do módulo, e ele não inventa dado —
 * repete a constante que já está na migration.
 */
async function lerCotacao(cliente: SupabaseClient<Database>): Promise<Taxa> {
  const { data } = await cliente
    .from("catalog_settings")
    .select("brl_per_usd::text")
    .maybeSingle();

  const bruto = data?.brl_per_usd;
  return (bruto ? taxaDeTexto(bruto) : null) ?? TAXA_PADRAO;
}

/* --------------------------------- vitrine -------------------------------- */

/**
 * =============================================================================
 *  "SEM CONFIGURAÇÃO" NÃO É "DEU ERRO"
 * =============================================================================
 *
 *  O CI compila a aplicação SEM nenhuma variável do Supabase, de propósito: é
 *  a prova de que o projeto sobe sem segredo nenhum, e é o que permite o
 *  workflow existir sem secrets. Isso já era verdade antes do catálogo ir para
 *  o banco, e precisa continuar sendo.
 *
 *  Quando o catálogo passou a ser lido do banco, o build quebrou de imediato:
 *  `generateStaticParams` chamava `createPublicClient()`, que estoura sem as
 *  variáveis, e o `next build` parava em "Failed to collect page data for
 *  /livros/[slug]". Medido antes de publicar, com `.env.local` removido e o
 *  `.next/cache` limpo — sem limpar o cache, o build ANTERIOR responde pelo
 *  `fetch-cache` e o erro não aparece.
 *
 *  A saída é separar dois estados que não são o mesmo:
 *
 *    - NÃO CONFIGURADO → estado conhecido e deliberado, que a aplicação já
 *      modela em `isSupabaseConfigured()`. Devolve catálogo vazio. Não é
 *      fallback fictício: não inventa livro, preço nem capa — é a ausência de
 *      dado, honestamente representada como ausência.
 *
 *    - CONFIGURADO E A CONSULTA FALHOU → falha de verdade, e estoura. Um
 *      catálogo vazio e um catálogo que não carregou são a MESMA tela para o
 *      visitante e coisas opostas para quem mantém o site. Foi assim que a
 *      policy quebrada do `anon` quase passou batido.
 * =========================================================================== */
function semConfiguracao(): boolean {
  const { url, publishableKey } = getSupabaseEnv();
  return !url || !publishableKey;
}

/**
 * =============================================================================
 *  DURANTE O BUILD, O BANCO FORA DO AR NÃO PODE DERRUBAR O DEPLOY
 * =============================================================================
 *
 *  Um terceiro passo, que só apareceu ao reproduzir o ambiente do CI: com as
 *  variáveis PRESENTES mas apontando para um projeto inexistente, o `fetch`
 *  falha, a leitura estoura e o `next build` para em "Failed to collect page
 *  data for /livros/[slug]".
 *
 *  A situação não é hipotética nem exclusiva do CI: qualquer instabilidade do
 *  Supabase durante um deploy produziria exatamente isso. Um build que depende
 *  de um serviço externo estar no ar é um build que falha sozinho.
 *
 *  A regra, então, depende de QUANDO a leitura acontece:
 *
 *    durante o build  → registra o erro e segue com o que tiver. Pré-renderizar
 *                       é otimização; não conseguir pré-renderizar é aceitável,
 *                       e `dynamicParams` continua servindo a página sob
 *                       demanda depois.
 *
 *    durante o pedido → ESTOURA. Aqui há um visitante esperando, e uma página
 *                       que finge um catálogo vazio esconde uma falha que
 *                       precisa aparecer no monitoramento.
 *
 *  O `revalidate` das rotas públicas fecha o ciclo: se um build ruim gerar a
 *  vitrine vazia, ela se recompõe sozinha na próxima revalidação, sem esperar
 *  um deploy novo.
 */
const DURANTE_O_BUILD = process.env.NEXT_PHASE === "phase-production-build";

/**
 * =============================================================================
 *  EM PRODUÇÃO, UM BUILD SEM CATÁLOGO NÃO PODE VIRAR UM SITE SEM CATÁLOGO
 * =============================================================================
 *
 *  A tolerância descrita acima resolveu o CI e criou um risco pior, que só
 *  apareceu ao MEDIR o cenário completo em vez de raciocinar sobre ele:
 *
 *    1. build roda com o Supabase fora do ar → `/livros` é gerada VAZIA;
 *    2. o banco volta;
 *    3. o servidor sobe com o banco funcionando;
 *    4. `/livros` continua vazia — cinco requisições seguidas, zero livros.
 *
 *  O `revalidate = 3600` não socorre: ele diz que a página é FRESCA por uma
 *  hora. Uma vitrine vazia por uma hora, sem erro em lugar nenhum, é pior do
 *  que um deploy que não acontece.
 *
 *  `CATALOGO_OBRIGATORIO=1` fecha isso. Com a variável, uma falha de leitura
 *  derruba o build — e um build que falha não publica nada. É a definição de
 *  "não pode gerar e publicar uma página vazia".
 *
 *  Ela fica LIGADA em produção (Vercel) e desligada no CI, que compila contra
 *  um projeto fictício de propósito e precisa continuar verde. A distinção é
 *  explícita porque adivinhar o ambiente por heurística é o tipo de esperteza
 *  que falha justamente no dia do deploy.
 *
 *  O `comRepeticao` abaixo é o que impede a regra estrita de virar um estorvo:
 *  uma oscilação de dois segundos custa duas tentativas, não um deploy.
 */
const CATALOGO_OBRIGATORIO = process.env.CATALOGO_OBRIGATORIO === "1";

function falhaDeLeitura(contexto: string, detalhe: unknown): never | void {
  const erro = new Error(`Falha ao ler o catálogo (${contexto}): ${String(detalhe)}`);

  if (!DURANTE_O_BUILD || CATALOGO_OBRIGATORIO) throw erro;

  console.error(`[catálogo] ${erro.message} — seguindo com o catálogo vazio neste build.`);
}

/**
 * Três tentativas com espera crescente, só durante o build.
 *
 * Em tempo de requisição não há repetição: há alguém esperando a página, e
 * três tentativas transformariam um erro rápido numa espera longa que termina
 * em erro do mesmo jeito. No build, o custo de esperar é irrelevante perto do
 * custo de um deploy que não acontece por causa de uma oscilação de rede.
 */
type Resultado<T> = { data: T; error: { message: string } | null };

/* `PromiseLike`, e não `Promise`: o construtor de consultas do supabase-js é
   um THENABLE — tem `then`, não tem `catch` nem `finally`. Exigir `Promise`
   aqui obriga cada chamada a um `await` extra só para satisfazer o tipo. */
async function comRepeticao<T>(
  operacao: () => PromiseLike<Resultado<T>>,
): Promise<Resultado<T>> {
  const tentativas = DURANTE_O_BUILD ? 3 : 1;
  let ultimo = await operacao();

  for (let i = 1; i < tentativas && ultimo.error; i++) {
    await new Promise((resolver) => setTimeout(resolver, 1000 * i));
    console.error(`[catálogo] tentativa ${i + 1} de ${tentativas} após: ${ultimo.error.message}`);
    ultimo = await operacao();
  }

  return ultimo;
}

async function buscarCatalogo(locale: Locale): Promise<LivroPublico[]> {
  if (semConfiguracao()) return [];
  const supabase = createPublicClient();

  const [{ data, error }, taxa] = await Promise.all([
    comRepeticao(() =>
      supabase
        .from("books")
        .select(SELECAO)
        .eq("status", "published")
        .order("order_index", { ascending: true }),
    ),
    lerCotacao(supabase),
  ]);

  /* Erro de leitura ESTOURA, em vez de devolver lista vazia. Um catálogo
     vazio e um catálogo que falhou são a mesma tela para o visitante e coisas
     opostas para quem mantém o site — foi exatamente assim que a policy
     quebrada do `anon` quase passou despercebida. A exceção é o build, pelo
     motivo explicado em `falhaDeLeitura`. */
  if (error) {
    falhaDeLeitura(`catálogo ${locale}`, error.message);
    return [];
  }

  return (data as LinhaCatalogo[]).map((linha) => montarLivro(linha, locale, taxa));
}

/**
 * O catálogo publicado, cacheado até um administrador mexer em alguma coisa.
 *
 * `unstable_cache` em vez de deixar o `fetch` do Supabase decidir: em Next 15 o
 * `fetch` padrão é `no-store`, e uma página que faz consulta sem cache vira
 * dinâmica — o catálogo iria ao banco a cada visita para devolver a mesma
 * página a todo mundo. A tag é o que permite invalidar na hora do salvamento
 * em vez de esperar um tempo arbitrário expirar.
 */
export const getCatalogo = unstable_cache(buscarCatalogo, ["catalogo-publico"], {
  tags: [TAG_CATALOGO],
});

async function buscarLivro(locale: Locale, slug: string): Promise<LivroPublico | null> {
  if (semConfiguracao()) return null;
  const supabase = createPublicClient();

  const [{ data, error }, taxa] = await Promise.all([
    comRepeticao(() =>
      supabase
        .from("books")
        .select(SELECAO)
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle(),
    ),
    lerCotacao(supabase),
  ]);

  if (error) {
    falhaDeLeitura(`livro ${slug}`, error.message);
    return null;
  }
  if (!data) return null;

  return montarLivro(data as LinhaCatalogo, locale, taxa);
}

/**
 * Um livro publicado. `null` quando o slug não existe OU não está publicado —
 * quem chama devolve 404 nos dois casos, que é o que o visitante deve ver.
 *
 * O `unstable_cache` é criado POR SLUG, e não uma vez para a função inteira,
 * porque `tags` é fixo na criação. Sem este embrulho, todas as páginas de
 * livro compartilhariam a mesma tag e salvar um título derrubaria o cache dos
 * seis. Com ele, a página de detalhe leva só a tag do próprio livro — e é o
 * que permite invalidar o slug ANTIGO e o NOVO quando o endereço muda, que é
 * o caso em que errar deixa um 404 em cache.
 */
export function getLivro(locale: Locale, slug: string): Promise<LivroPublico | null> {
  return unstable_cache(() => buscarLivro(locale, slug), ["livro-publico", locale, slug], {
    tags: [tagLivro(slug)],
  })();
}

/**
 * A cotação vigente, para a vitrine EXPLICAR o número que está mostrando.
 *
 * A nota em inglês dizia, escrita à mão em `site.ts`, "converted at R$ 5.10
 * per US$ 1". Enquanto a cotação era constante isso era verdade; com ela
 * editável no painel, virou uma afirmação que o site faz e que pode estar
 * errada — bastava o administrador salvar 6,00 para a página continuar
 * jurando 5,10 ao lado de preços calculados com outro número.
 *
 * Agora a frase é montada com o valor real. Mesma tag do catálogo: mudar a
 * cotação já invalida as listagens, e a nota acompanha na mesma revalidação.
 */
export const getCotacaoPublica = unstable_cache(
  async (): Promise<Taxa> => {
    if (semConfiguracao()) return TAXA_PADRAO;
    return lerCotacao(createPublicClient());
  },
  ["cotacao-publica"],
  { tags: [TAG_CATALOGO] },
);

/**
 * Os slugs publicados — usados por `generateStaticParams` e pelo sitemap.
 *
 * Substitui a constante `BOOK_SLUGS`, que era escrita à mão. A lista agora vem
 * de onde os livros vivem, e um título novo entra no sitemap sem ninguém
 * lembrar de editar um segundo arquivo.
 */
export const getSlugsPublicados = unstable_cache(
  async (): Promise<string[]> => {
    if (semConfiguracao()) return [];
    const supabase = createPublicClient();
    const { data, error } = await comRepeticao(() =>
      supabase
        .from("books")
        .select("slug")
        .eq("status", "published")
        .order("order_index", { ascending: true }),
    );

    if (error) {
      falhaDeLeitura("lista de slugs", error.message);
      return [];
    }
    return (data ?? []).map((linha) => linha.slug);
  },
  ["slugs-publicados"],
  { tags: [TAG_CATALOGO] },
);

/* --------------------------------- painel --------------------------------- */

export type LivroAdmin = {
  id: string;
  slug: string;
  title: string;
  status: BookStatus;
  orderIndex: number;
  printPriceCents: number | null;
  ebookPriceCents: number | null;
  cover: { path: string; url: string; width: number | null; height: number | null };
  localizacoes: Record<Locale, { synopsis: string; coverAlt: string }>;
  links: Record<BookStore, string | null>;
  updatedAt: string;
};

const SELECAO_ADMIN = `
  id, slug, title, status, order_index,
  print_price_cents, ebook_price_cents,
  cover_path, cover_width, cover_height, updated_at,
  book_localizations ( locale, synopsis, cover_alt ),
  book_store_links ( store, url )
` as const;

type LinhaAdmin = LinhaCatalogo & { id: string; updated_at: string };

function montarLivroAdmin(linha: LinhaAdmin): LivroAdmin {
  const loc = (l: Locale) => {
    const encontrado = linha.book_localizations.find((x) => x.locale === l);
    return { synopsis: encontrado?.synopsis ?? "", coverAlt: encontrado?.cover_alt ?? "" };
  };
  const url = (loja: BookStore) =>
    linha.book_store_links.find((x) => x.store === loja)?.url ?? null;

  return {
    id: linha.id,
    slug: linha.slug,
    title: linha.title,
    status: linha.status,
    orderIndex: linha.order_index,
    printPriceCents: linha.print_price_cents,
    ebookPriceCents: linha.ebook_price_cents,
    cover: {
      path: linha.cover_path,
      url: urlDaCapa(linha.cover_path),
      width: linha.cover_width,
      height: linha.cover_height,
    },
    localizacoes: { pt: loc("pt"), en: loc("en") },
    links: { amazon: url("amazon"), clube_de_autores: url("clube_de_autores") },
    updatedAt: linha.updated_at,
  };
}

export type FiltroLivros = {
  /** Título ou slug, sem diferenciar maiúsculas nem acentos. */
  busca?: string;
  status?: BookStatus | "all";
};

/** Sem acento e em minúsculas — "Devagar também" tem que ser achado por "tambem". */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * A listagem do painel.
 *
 * `requireAdmin()` roda AQUI, e não só no layout: layout e página podem buscar
 * dados em paralelo, e `generateMetadata` roda junto da página — "o pai já
 * checou" não é garantia de ordem nenhuma. O mesmo raciocínio de
 * `dal/admin.ts`.
 *
 * Sem cache, de propósito: quem acabou de salvar precisa ver o que salvou.
 *
 * A busca é filtrada em memória e não com `ilike` porque acento importa: o
 * `ilike` do Postgres não considera "também" e "tambem" a mesma palavra, e o
 * catálogo tem seis títulos — o custo de trazer todos é irrelevante e a busca
 * fica igual à da tela de alunos, que já funciona assim.
 */
export async function listarLivros(filtro: FiltroLivros = {}): Promise<LivroAdmin[]> {
  await requireAdmin("/admin/livros");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("books")
    .select(SELECAO_ADMIN)
    .order("order_index", { ascending: true });

  if (error) throw new Error(`Falha ao listar livros: ${error.message}`);

  let livros = (data as LinhaAdmin[]).map(montarLivroAdmin);

  if (filtro.status && filtro.status !== "all") {
    livros = livros.filter((livro) => livro.status === filtro.status);
  }

  const busca = normalizar(filtro.busca ?? "");
  if (busca) {
    livros = livros.filter(
      (livro) =>
        normalizar(livro.title).includes(busca) || normalizar(livro.slug).includes(busca),
    );
  }

  return livros;
}

/**
 * Um livro para edição, pelo ID.
 *
 * O ID vem da URL, ou seja, do usuário. A proteção contra IDOR não está numa
 * checagem escrita aqui — está na policy `books_select_authenticated`, que só
 * devolve rascunho e arquivado para quem `is_admin()` aprova. Trocar o UUID na
 * barra de endereço não abre nada, e há teste com sessão real de aluno
 * segurando o UUID de um rascunho para provar isso.
 */
export async function getLivroParaEdicao(id: string): Promise<LivroAdmin | null> {
  await requireAdmin("/admin/livros");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("books")
    .select(SELECAO_ADMIN)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler o livro: ${error.message}`);
  return data ? montarLivroAdmin(data as LinhaAdmin) : null;
}

/** A cotação atual, para o painel exibir e para a pré-visualização calcular. */
export async function getCotacaoAdmin(): Promise<{ taxa: Taxa; atualizadaEm: string | null }> {
  await requireAdmin("/admin/livros");
  const supabase = await createClient();

  const { data } = await supabase
    .from("catalog_settings")
    .select("brl_per_usd::text, updated_at")
    .maybeSingle();

  const linha = data as { brl_per_usd?: string; updated_at?: string } | null;
  return {
    taxa: (linha?.brl_per_usd ? taxaDeTexto(linha.brl_per_usd) : null) ?? TAXA_PADRAO,
    atualizadaEm: linha?.updated_at ?? null,
  };
}

/**
 * O livro como a vitrine o mostrará, incluindo rascunho — a pré-visualização
 * antes de publicar.
 *
 * Passa pela sessão do administrador (não pelo cliente anônimo) porque é
 * justamente o rascunho que precisa aparecer. É a ÚNICA leitura de rascunho
 * fora do painel, e ela exige `requireAdmin()` antes de qualquer consulta.
 */
export async function getLivroParaPreview(
  id: string,
  locale: Locale,
): Promise<LivroPublico | null> {
  await requireAdmin("/admin/livros");
  const supabase = await createClient();

  const [{ data, error }, taxa] = await Promise.all([
    supabase.from("books").select(SELECAO).eq("id", id).maybeSingle(),
    lerCotacao(supabase),
  ]);

  if (error) throw new Error(`Falha ao pré-visualizar: ${error.message}`);
  return data ? montarLivro(data as LinhaCatalogo, locale, taxa) : null;
}
