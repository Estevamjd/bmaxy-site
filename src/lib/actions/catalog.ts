"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { adminContent } from "@/content/admin";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_CAPAS, TAG_CATALOGO, tagLivro } from "@/lib/dal/catalog";
import { taxaParaTexto } from "@/lib/money";
import {
  EXTENSAO_POR_TIPO,
  TAMANHO_MAXIMO_CAPA,
  TIPOS_CAPA,
  createCatalogValidation,
} from "@/lib/validation/catalog";

export type CatalogActionState = { error?: string; success?: string } | undefined;

/**
 * =============================================================================
 *  CATÁLOGO — escrita
 * =============================================================================
 *
 *  TODA action começa com `requireAdmin()`, antes de ler o formulário.
 *
 *  Não é a única defesa, e é importante que não seja: `requireAdmin()` protege
 *  a interface (redireciona quem não deveria estar ali), enquanto quem protege
 *  o DADO é a RLS. Uma requisição forjada direto para a Server Action, sem
 *  passar por tela nenhuma, esbarra nas policies `*_write_admin` e não escreve
 *  coisa alguma. Há teste com sessão real de aluno provando isso.
 *
 *  Nada aqui confia em `role`, `user_id` ou `is_admin` vindos do formulário —
 *  nenhum desses campos é sequer lido. A identidade sai do cookie de sessão,
 *  revalidada no servidor do Supabase, e a autorização sai de `user_roles`.
 * =========================================================================== */

async function contexto(nextPath: string) {
  const auth = await requireAdmin(nextPath);
  return {
    auth,
    copy: adminContent[auth.locale].actions,
    schemas: createCatalogValidation(auth.locale),
  };
}

/* -------------------------------------------------------------------------- */
/*  Revalidação                                                                */
/* -------------------------------------------------------------------------- */

/**
 * O que precisa esquecer o que sabia depois de uma alteração.
 *
 * `slugs` recebe o slug ANTIGO e o NOVO quando o endereço muda. Esquecer o
 * antigo é o que evita o pior caso: a página velha continua servida do cache,
 * com o conteúdo velho, num endereço que já não existe no banco — e o
 * visitante vê um livro que o administrador acha que renomeou.
 *
 * As tags cobrem os dados. Os `revalidatePath` cobrem as rotas que os
 * consomem, incluindo o sitemap, que lista slugs e portanto muda quando um
 * livro é publicado, arquivado ou renomeado.
 */
function revalidarCatalogo(slugs: (string | null | undefined)[] = []) {
  revalidateTag(TAG_CATALOGO);

  for (const slug of new Set(slugs.filter(Boolean) as string[])) {
    revalidateTag(tagLivro(slug));
    revalidatePath(`/livros/${slug}`);
    revalidatePath(`/en/books/${slug}`);
  }

  revalidatePath("/livros");
  revalidatePath("/en/books");
  revalidatePath("/sitemap.xml");
}

/* -------------------------------------------------------------------------- */
/*  Criar                                                                      */
/* -------------------------------------------------------------------------- */

export async function criarLivroAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const { copy, schemas } = await contexto("/admin/livros/novo");

  const parsed = schemas.criarLivroSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_book", {
    p_slug: parsed.data.slug,
    p_title: parsed.data.title,
  });

  if (error) {
    /* 23505 é o unique de `slug`. Distinguir importa: "já existe um livro com
       este identificador" é acionável, "não foi possível criar" faz o
       administrador tentar de novo com os mesmos dados. */
    if (error.code === "23505") return { error: copy.duplicateBookSlug };
    return { error: copy.createBookFailed };
  }

  /* Nasce como rascunho e não aparece na vitrine — mas o sitemap e as
     listagens do painel mudam, e a próxima leitura precisa ver o livro novo. */
  revalidarCatalogo([parsed.data.slug]);
  return { success: copy.bookCreated };
}

/* -------------------------------------------------------------------------- */
/*  Salvar                                                                     */
/* -------------------------------------------------------------------------- */

export async function salvarLivroAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const { copy, schemas } = await contexto("/admin/livros");

  const parsed = schemas.salvarLivroSchema.safeParse({
    bookId: formData.get("bookId"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    printPrice: formData.get("printPrice") ?? "",
    ebookPrice: formData.get("ebookPrice") ?? "",
    synopsisPt: formData.get("synopsisPt") ?? "",
    synopsisEn: formData.get("synopsisEn") ?? "",
    coverAltPt: formData.get("coverAltPt") ?? "",
    coverAltEn: formData.get("coverAltEn") ?? "",
    amazon: formData.get("amazon") ?? "",
    clubeDeAutores: formData.get("clubeDeAutores") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const dados = parsed.data;
  const supabase = await createClient();

  /* O slug ANTIGO é lido antes de escrever. Sem ele não há como invalidar a
     página do endereço que deixou de existir — e o `bookId` do formulário não
     ajuda a descobri-lo depois do UPDATE. */
  const { data: anterior } = await supabase
    .from("books")
    .select("slug")
    .eq("id", dados.bookId)
    .maybeSingle();

  if (!anterior) return { error: copy.bookNotFound };

  /* `.select()` no fim do UPDATE não é enfeite: um UPDATE que a RLS filtra
     inteiro volta SEM erro e com zero linhas. Sem conferir a linha de volta,
     uma escrita recusada por permissão passaria por "salvo com sucesso". */
  const { data: atualizado, error: erroLivro } = await supabase
    .from("books")
    .update({
      slug: dados.slug,
      title: dados.title,
      print_price_cents: dados.printPrice,
      ebook_price_cents: dados.ebookPrice,
    })
    .eq("id", dados.bookId)
    .select("id")
    .maybeSingle();

  if (erroLivro) {
    if (erroLivro.code === "23505") return { error: copy.duplicateBookSlug };
    return { error: copy.saveBookFailed };
  }
  if (!atualizado) return { error: copy.bookNotFound };

  const localizacoes = [
    { locale: "pt" as const, synopsis: dados.synopsisPt, cover_alt: dados.coverAltPt },
    { locale: "en" as const, synopsis: dados.synopsisEn, cover_alt: dados.coverAltEn },
  ];

  for (const loc of localizacoes) {
    const { error } = await supabase
      .from("book_localizations")
      .update({ synopsis: loc.synopsis, cover_alt: loc.cover_alt })
      .eq("book_id", dados.bookId)
      .eq("locale", loc.locale);

    if (error) return { error: copy.saveBookFailed };
  }

  const lojas = [
    { store: "amazon" as const, url: dados.amazon },
    { store: "clube_de_autores" as const, url: dados.clubeDeAutores },
  ];

  for (const loja of lojas) {
    if (loja.url === null) {
      /* Link em branco APAGA a linha em vez de gravar string vazia: o CHECK de
         tamanho mínimo recusaria a string vazia, e a ausência da linha é o que
         a vitrine já entende como "não exibir o botão". */
      const { error } = await supabase
        .from("book_store_links")
        .delete()
        .eq("book_id", dados.bookId)
        .eq("store", loja.store);
      if (error) return { error: copy.saveBookFailed };
      continue;
    }

    /**
     * UPDATE e, só se não houver linha, INSERT. Não é `upsert`, e a diferença
     * importa.
     *
     * `upsert` vira `ON CONFLICT DO UPDATE` no Postgres, que exige privilégio
     * de UPDATE em TODAS as colunas enviadas — inclusive `book_id` e `store`.
     * O grant desta tabela é `update (url)` de propósito: mover um link de um
     * livro para outro não é uma operação que exista. O resultado era
     * `42501 permission denied for table book_store_links` em toda tentativa
     * de salvar link, e o formulário inteiro falhava depois de já ter gravado
     * título e preços.
     *
     * O defeito passou pelos testes de banco porque eles usam `insert` e
     * `update` diretos; só apareceu ao preencher o formulário num navegador.
     */
    const { data: atualizada, error: erroUpdate } = await supabase
      .from("book_store_links")
      .update({ url: loja.url })
      .eq("book_id", dados.bookId)
      .eq("store", loja.store)
      .select("book_id")
      .maybeSingle();

    if (erroUpdate) return { error: copy.saveBookFailed };

    if (!atualizada) {
      const { error: erroInsert } = await supabase
        .from("book_store_links")
        .insert({ book_id: dados.bookId, store: loja.store, url: loja.url });

      if (erroInsert) return { error: copy.saveBookFailed };
    }
  }

  revalidarCatalogo([anterior.slug, dados.slug]);
  return { success: copy.bookUpdated };
}

/* -------------------------------------------------------------------------- */
/*  Publicar / despublicar / arquivar                                          */
/* -------------------------------------------------------------------------- */

/**
 * Não existe exclusão. Arquivar tira o livro da vitrine e da lista padrão do
 * painel, e mantém slug, capa, sinopses e links intactos — o erro que se quer
 * impedir é o irreversível. Restaurar devolve o livro como rascunho, para ele
 * ser conferido antes de voltar ao ar.
 */
export async function alterarStatusLivroAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const { copy, schemas } = await contexto("/admin/livros");

  const parsed = schemas.statusLivroSchema.safeParse({
    bookId: formData.get("bookId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: copy.invalidData };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.bookId)
    .select("slug")
    .maybeSingle();

  if (error) return { error: copy.bookStatusFailed };
  if (!data) return { error: copy.bookNotFound };

  revalidarCatalogo([data.slug]);

  const mensagens = {
    published: copy.bookPublished,
    draft: copy.bookUnpublished,
    archived: copy.bookArchived,
  } as const;

  return { success: mensagens[parsed.data.status] };
}

/** Restaurar é voltar para rascunho — mensagem própria, mesma escrita. */
export async function restaurarLivroAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const { copy } = await contexto("/admin/livros");
  const resultado = await alterarStatusLivroAction(undefined, formData);
  return resultado?.success ? { success: copy.bookRestored } : resultado;
}

/* -------------------------------------------------------------------------- */
/*  Reordenar                                                                  */
/* -------------------------------------------------------------------------- */

export async function moverLivroAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const { copy, schemas } = await contexto("/admin/livros");

  const parsed = schemas.moverLivroSchema.safeParse({
    bookId: formData.get("bookId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return { error: copy.invalidData };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_book", {
    p_book_id: parsed.data.bookId,
    p_direction: parsed.data.direction,
  });

  if (error) return { error: copy.bookMoveFailed };

  /* `false` = o livro já é o primeiro ou o último. Não é falha, e tratar como
     erro faria o painel mostrar vermelho para um clique que só não tinha para
     onde ir. */
  if (data === false) return { success: copy.bookMoveEdge };

  revalidarCatalogo();
  return { success: copy.bookMoved };
}

/* -------------------------------------------------------------------------- */
/*  Capa                                                                       */
/* -------------------------------------------------------------------------- */

export async function enviarCapaAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const { auth, copy } = await contexto("/admin/livros");
  const validacao = adminContent[auth.locale].validation;

  const bookId = String(formData.get("bookId") ?? "");
  const arquivo = formData.get("cover");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookId)) {
    return { error: copy.invalidData };
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { error: validacao.coverEmpty };
  }
  if (arquivo.size > TAMANHO_MAXIMO_CAPA) {
    return { error: validacao.coverTooLarge };
  }
  if (!(TIPOS_CAPA as readonly string[]).includes(arquivo.type)) {
    return { error: validacao.coverType };
  }

  const supabase = await createClient();

  const { data: livro } = await supabase
    .from("books")
    .select("slug, cover_path")
    .eq("id", bookId)
    .maybeSingle();

  if (!livro) return { error: copy.bookNotFound };

  /**
   * O NOME DO ARQUIVO É GERADO AQUI, e nada do nome enviado é reaproveitado.
   *
   * `arquivo.name` vem do cliente: pode ser `../../../etc/algo`, `capa.jpg.svg`,
   * um nome com barras que criaria pastas, ou 4 KB de caracteres. Um UUID
   * resolve os três problemas de uma vez — é único, é seguro como caminho, e
   * não carrega informação nenhuma do que foi enviado.
   *
   * A extensão vem do TIPO já validado contra a lista, não do nome. E o nome
   * novo a cada envio também evita o problema clássico de substituir capa:
   * reusar o caminho manteria a imagem antiga em cache no navegador e nas
   * CDNs, e o administrador veria a capa velha depois de trocar.
   */
  const extensao = EXTENSAO_POR_TIPO[arquivo.type];
  const caminho = `capas/${randomUUID()}.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_CAPAS)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

  /* O bucket também recusa por tipo e tamanho, e é ele que vale: as checagens
     acima dão mensagem melhor, esta é a que não dá para contornar. */
  if (erroUpload) return { error: copy.coverRejected };

  const { data: atualizado, error: erroLivro } = await supabase
    .from("books")
    .update({ cover_path: caminho, cover_width: null, cover_height: null })
    .eq("id", bookId)
    .select("id")
    .maybeSingle();

  if (erroLivro || !atualizado) {
    /* A imagem subiu e o livro não apontou para ela: o objeto ficaria órfão no
       bucket para sempre. Remove-se o que ESTA execução criou — e só ele. */
    await supabase.storage.from(BUCKET_CAPAS).remove([caminho]);
    return { error: copy.coverFailed };
  }

  /* A capa anterior só é removida se for um objeto do Storage. As seis capas
     migradas vivem em `public/` e são versionadas no repositório — apagá-las
     não é sequer possível daqui, e o `startsWith("/")` garante que nem se
     tente. */
  if (livro.cover_path && !livro.cover_path.startsWith("/")) {
    await supabase.storage.from(BUCKET_CAPAS).remove([livro.cover_path]);
  }

  revalidarCatalogo([livro.slug]);
  return { success: copy.coverUpdated };
}

/* -------------------------------------------------------------------------- */
/*  Cotação                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Uma alteração aqui muda o valor em dólar de TODOS os livros de uma vez.
 *
 * É por isso que a conversão não é guardada em coluna nenhuma: se estivesse,
 * mudar a cotação exigiria reescrever todos os livros, e qualquer falha no
 * meio deixaria metade do catálogo numa cotação e metade noutra.
 */
export async function salvarCotacaoAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const { auth, copy, schemas } = await contexto("/admin/livros");

  const parsed = schemas.cotacaoSchema.safeParse({ rate: formData.get("rate") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_settings")
    .update({
      /* Texto decimal, não número: é o `numeric(10,4)` do banco recebendo o
         valor exato que o administrador digitou. */
      brl_per_usd: taxaParaTexto(parsed.data.rate),
      updated_by: auth.userId,
    })
    .eq("id", true)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: copy.rateFailed };

  revalidarCatalogo();
  return { success: copy.rateUpdated };
}
