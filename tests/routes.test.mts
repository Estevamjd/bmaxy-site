import assert from "node:assert/strict";
import test from "node:test";
import {
  alternatePath,
  bookPath,
  pageKeyForPath,
  pagePath,
  type PageKey,
} from "../src/lib/routes.ts";

/**
 * O seletor PT/EN precisa levar à PÁGINA EQUIVALENTE, não à home. Antes ele
 * mandava todo mundo para a home do outro idioma — fazia sentido quando só a
 * home era bilíngue e virou perda de contexto quando as internas ganharam
 * versão em inglês. Estes testes travam o comportamento novo.
 */

const PAGINAS: PageKey[] = [
  "home",
  "about",
  "books",
  "consulting",
  "ghostwriting",
  "course",
];

test("toda página tem caminho nos dois idiomas, e eles são diferentes fora da home", () => {
  for (const key of PAGINAS) {
    const pt = pagePath(key, "pt");
    const en = pagePath(key, "en");

    assert.ok(pt.startsWith("/"), `${key}: caminho pt precisa começar com "/"`);
    assert.ok(en.startsWith("/en"), `${key}: caminho en precisa começar com "/en"`);
    assert.notEqual(pt, en, `${key}: pt e en não podem ser o mesmo caminho`);
  }
});

test("a troca de idioma preserva a página, nos dois sentidos", () => {
  for (const key of PAGINAS) {
    const pt = pagePath(key, "pt");
    const en = pagePath(key, "en");

    assert.equal(alternatePath(pt, "en"), en, `${key}: pt -> en`);
    assert.equal(alternatePath(en, "pt"), pt, `${key}: en -> pt`);
  }
});

test("ida e volta devolve ao caminho original", () => {
  for (const key of PAGINAS) {
    const pt = pagePath(key, "pt");
    assert.equal(alternatePath(alternatePath(pt, "en"), "pt"), pt, `${key}: ida e volta`);
  }
});

/**
 * Slugs de amostra. Era `BOOK_SLUGS`, uma constante com os seis títulos, que
 * saiu do código quando o catálogo passou a viver no banco.
 *
 * O que está sendo testado aqui NUNCA foi "estes seis livros existem" — é a
 * simetria da troca de idioma para um slug qualquer. Por isso a lista inclui
 * um slug com dígito no começo (que existe de verdade e já quebrou expressão
 * regular ingênua) e um inventado: `alternatePath` não deve consultar
 * catálogo nenhum, e quem responde 404 é a página de destino.
 */
const SLUGS_DE_AMOSTRA = [
  "aaron-tucker",
  "5-passos-importantes-para-prosperar",
  "livro-que-nao-existe",
];

test("a troca de idioma preserva o livro, nos dois sentidos", () => {
  for (const slug of SLUGS_DE_AMOSTRA) {
    const pt = bookPath(slug, "pt");
    const en = bookPath(slug, "en");

    assert.equal(alternatePath(pt, "en"), en, `${slug}: pt -> en`);
    assert.equal(alternatePath(en, "pt"), pt, `${slug}: en -> pt`);
    // O slug é o mesmo nos dois idiomas — é título de obra, nome próprio.
    assert.ok(en.endsWith(`/${slug}`), `${slug}: o slug não pode ser traduzido`);
  }
});

test("barra final não muda o destino", () => {
  assert.equal(alternatePath("/livros/", "en"), pagePath("books", "en"));
  assert.equal(alternatePath("/en/books/", "pt"), pagePath("books", "pt"));
});

test("rota sem equivalente cai na home do idioma de destino", () => {
  // A plataforma ainda só existe em português; mandar para a home do outro
  // idioma é o único destino honesto enquanto não houver tradução.
  for (const rota of ["/entrar", "/cadastro", "/aluno", "/admin/alunos"]) {
    assert.equal(alternatePath(rota, "en"), "/en", `${rota} -> home en`);
    assert.equal(alternatePath(rota, "pt"), "/", `${rota} -> home pt`);
  }
});

test("a troca de idioma preserva o slug mesmo sem saber se o livro existe", () => {
  /* MUDANÇA DE COMPORTAMENTO, registrada de propósito.
   *
   * Antes, um slug fora da lista fixa caía no catálogo do outro idioma. Só
   * era possível porque `isBookSlug` conferia contra os seis títulos escritos
   * no código; com o catálogo no banco, essa lista deixou de existir — e este
   * módulo é importado por Client Components, que não consultam banco.
   *
   * O novo comportamento é o correto de qualquer forma. Para chegar a
   * `/livros/<x>` o livro precisa existir (senão a própria página já é 404),
   * então o caso do slug desconhecido só acontece com URL digitada à mão — e
   * aí um 404 no idioma de destino é mais honesto do que despejar a pessoa no
   * catálogo fingindo que o pedido foi atendido. */
  assert.equal(alternatePath("/livros/nao-existe", "en"), "/en/books/nao-existe");
  assert.equal(alternatePath("/en/books/nao-existe", "pt"), "/livros/nao-existe");
});

test("caminho malformado sob o catálogo cai no catálogo, não escapa da seção", () => {
  /* O formato ainda é conferido. Uma barra ou um ".." no meio virariam OUTRA
     rota, e o seletor de idioma não pode ser o caminho para isso. */
  for (const ruim of ["/livros/a/b", "/livros/../admin", "/livros/COM-MAIUSCULA"]) {
    assert.equal(alternatePath(ruim, "en"), pagePath("books", "en"), ruim);
  }
});

test("pageKeyForPath reconhece a página nos dois idiomas e nas sub-rotas", () => {
  assert.equal(pageKeyForPath("/"), "home");
  assert.equal(pageKeyForPath("/en"), "home");

  for (const key of PAGINAS) {
    assert.equal(pageKeyForPath(pagePath(key, "pt")), key, `pt: ${key}`);
    assert.equal(pageKeyForPath(pagePath(key, "en")), key, `en: ${key}`);
  }

  // É o que mantém "Livros" marcado no menu enquanto se lê um livro.
  assert.equal(pageKeyForPath("/livros/aaron-tucker"), "books");
  assert.equal(pageKeyForPath("/en/books/aaron-tucker"), "books");
});

test("rota da plataforma não corresponde a nenhuma página do menu", () => {
  for (const rota of ["/entrar", "/cadastro", "/aluno", "/admin"]) {
    assert.equal(pageKeyForPath(rota), null, rota);
  }
});
