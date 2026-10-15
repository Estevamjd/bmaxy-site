import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { siteContent, type Locale } from "../src/content/site.ts";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../..");
const APP = path.join(RAIZ, "src", "app");
const IDIOMAS: Locale[] = ["pt", "en"];

test("identidade e metadados usam os dados oficiais aprovados", () => {
  for (const locale of IDIOMAS) {
    const site = siteContent[locale];
    assert.equal(site.meta.company, "BMAXY LLC");
    assert.equal(site.meta.authorName, "Rodrigo Gambini");
    assert.equal(site.meta.url, "https://bmaxy.com");
  }
});

test("a home tem três caminhos bilíngues e âncoras distintas", () => {
  assert.equal(siteContent.pt.paths.anchor, "caminhos");
  assert.equal(siteContent.en.paths.anchor, "paths");
  assert.equal(siteContent.pt.paths.items.length, 3);
  assert.equal(siteContent.en.paths.items.length, 3);
  assert.equal(siteContent.pt.hero.primaryCta.href, "#caminhos");
  assert.equal(siteContent.en.hero.primaryCta.href, "#paths");
});

test("o site não publica contagens de aulas sem aprovação", () => {
  const texto = `${JSON.stringify(siteContent)}\n${readFileSync(path.join(RAIZ, "supabase", "seed.sql"), "utf8")}`;
  for (const proibido of [
    "20 aulas",
    "Vinte aulas",
    "6 já gravadas",
    "20 video lessons",
    "Twenty video lessons",
    "6 already recorded",
  ]) {
    assert.ok(!texto.includes(proibido), `contagem não aprovada encontrada: ${proibido}`);
  }
});

test("a versão inglesa preserva títulos oficiais e leva o locale ao login", () => {
  assert.equal(siteContent.en.books.titleNote, "Original titles in Portuguese.");

  /* A comparação título a título entre pt e en saiu daqui junto com o
     catálogo. Ela agora é estrutural, não uma asserção: `books.title` é UMA
     coluna, lida pelos dois idiomas. Não existe título em inglês para
     divergir do português — inventar um sugeriria uma tradução publicada que
     não existe, e é justamente isso que a nota acima avisa ao leitor. */

  assert.equal(siteContent.en.studentArea.href, "/entrar?locale=en");
  assert.equal(siteContent.en.signupLink.href, "/cadastro?locale=en");
});

/* ========================================================================== */
/*  O catálogo saiu deste arquivo                                             */
/* ========================================================================== */

/**
 * Havia aqui cinco testes conferindo os seis livros: ordem, links de compra,
 * capa, sinopse e o dólar aproximado do catálogo em inglês.
 *
 * Eles não foram descartados — MUDARAM DE LUGAR, junto com o dado. Título,
 * sinopse, preço, capa e loja agora vivem no banco, e conferi-los aqui
 * validaria uma cópia que ninguém mais lê.
 *
 * Continuam sendo verificados, contra a fonte real, em:
 *
 *   - `catalogo-dados.mjs` — os mesmos invariantes, consultando o banco com a
 *     chave publicável: seis livros publicados, ordem sem buracos, https em
 *     todo link, sinopse e texto alternativo preenchidos nos dois idiomas.
 *   - `tests/money.test.mts` — a conversão para dólar, comparada com os
 *     valores que estavam publicados antes da migração.
 *
 * Este arquivo continua responsável pelo que é COPY do site, incluindo a nota
 * que explica ao leitor de inglês que os preços são aproximados.
 */
test("a nota de preço em inglês avisa que o valor é aproximado", () => {
  /* O texto precisa continuar existindo mesmo com os preços vindo do banco: é
     ele que informa que o valor em dólar é convertido, não cobrado. */
  assert.match(siteContent.en.books.priceNote ?? "", /Approximate USD/);
  assert.equal(siteContent.pt.books.priceNote, null);
});

test("a nota sobre títulos em português existe só na versão em inglês", () => {
  /* Os títulos são nomes de obra e ficam em português nos dois sites. Em
     português a observação não faria sentido nenhum. */
  assert.ok((siteContent.en.books.titleNote ?? "").trim().length > 0);
  assert.equal(siteContent.pt.books.titleNote, null);
});

/* ========================================================================== */
/*  Nenhum link interno aponta para rota inexistente                          */
/* ========================================================================== */

/**
 * As rotas que EXISTEM DE VERDADE, lidas de src/app — não de uma lista escrita
 * à mão, que envelheceria em silêncio. É isto que faz o teste valer: se
 * alguém apagar uma página e esquecer um link no menu, ele quebra aqui.
 *
 * Route groups — (pt), (app) — não entram no caminho. Segmentos dinâmicos —
 * [slug], [id] — viram um coringa.
 */
function coletarRotas(dir: string, prefixo = ""): string[] {
  const rotas: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completo = path.join(dir, entrada);
    if (!statSync(completo).isDirectory()) continue;
    if (entrada.startsWith("_") || entrada.startsWith(".")) continue;

    const eGrupo = entrada.startsWith("(") && entrada.endsWith(")");
    const segmento = eGrupo ? "" : `/${entrada}`;
    const proximo = prefixo + segmento;

    if (readdirSync(completo).some((f) => f === "page.tsx" || f === "page.ts")) {
      rotas.push(proximo === "" ? "/" : proximo);
    }
    rotas.push(...coletarRotas(completo, proximo));
  }
  return rotas;
}

const ROTAS = (() => {
  const encontradas = coletarRotas(APP);
  // A home de cada root layout vive em (pt)/page.tsx e en/page.tsx.
  if (readdirSync(path.join(APP, "(pt)")).includes("page.tsx")) encontradas.push("/");
  return [...new Set(encontradas)];
})();

function rotaExiste(href: string): boolean {
  const alvo = href.split("#")[0].split("?")[0].replace(/\/$/, "") || "/";
  const partesAlvo = alvo.split("/").filter(Boolean);

  return ROTAS.some((rota) => {
    const partesRota = rota.split("/").filter(Boolean);
    if (partesRota.length !== partesAlvo.length) return false;
    return partesRota.every((parte, i) =>
      parte.startsWith("[") && parte.endsWith("]") ? partesAlvo[i].length > 0 : parte === partesAlvo[i],
    );
  });
}

/** Todo valor de `href` dentro do conteúdo, em qualquer profundidade. */
function coletarHrefs(valor: unknown, caminho = ""): { href: string; onde: string }[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((item, i) => coletarHrefs(item, `${caminho}[${i}]`));
  }
  if (valor && typeof valor === "object") {
    return Object.entries(valor).flatMap(([chave, item]) => {
      const onde = caminho ? `${caminho}.${chave}` : chave;
      if (chave === "href" && typeof item === "string") return [{ href: item, onde }];
      return coletarHrefs(item, onde);
    });
  }
  return [];
}

test("src/app expõe as rotas esperadas (a varredura está funcionando)", () => {
  // Sanidade: se a coleta quebrar e devolver pouca coisa, os testes abaixo
  // passariam vazios sem verificar nada.
  for (const esperada of ["/", "/en", "/livros", "/en/books", "/cadastro", "/entrar"]) {
    assert.ok(ROTAS.includes(esperada), `rota não encontrada em src/app: ${esperada}`);
  }
  assert.ok(ROTAS.length >= 25, `poucas rotas encontradas (${ROTAS.length}) — varredura suspeita`);
});

test("nenhum link interno do conteúdo aponta para rota inexistente", () => {
  const quebrados: string[] = [];

  for (const locale of IDIOMAS) {
    for (const { href, onde } of coletarHrefs(siteContent[locale])) {
      // Externos e mailto não são rota deste site.
      if (!href.startsWith("/")) continue;
      if (!rotaExiste(href)) quebrados.push(`${locale}.${onde} -> ${href}`);
    }
  }

  assert.deepEqual(quebrados, [], `links apontando para rota inexistente:\n${quebrados.join("\n")}`);
});

test("a rota dinâmica de livro existe nos dois idiomas", () => {
  /* Antes este teste percorria os seis slugs de uma constante. Não pode mais:
     quais livros existem é decisão do painel, e a lista viveria desatualizada.

     O que continua verificável no código é o que importa aqui — que as DUAS
     rotas dinâmicas existam. Sem `[slug]` em um dos idiomas, o botão PT/EN
     levaria a um 404 em toda página de livro, e nenhum teste de conteúdo
     perceberia. Se o livro daquele slug existe é pergunta para o banco, e
     `catalogo-dados.mjs` a responde. */
  assert.ok(rotaExiste("/livros/qualquer-slug"), "sem rota dinâmica para /livros/[slug]");
  assert.ok(rotaExiste("/en/books/qualquer-slug"), "sem rota dinâmica para /en/books/[slug]");
});

test("todo item de menu e de rodapé leva a uma rota existente", () => {
  for (const locale of IDIOMAS) {
    const site = siteContent[locale];
    const links = [
      ...site.nav,
      ...site.footer.columns.flatMap((c) => c.links),
      ...site.footer.legal,
      site.studentArea,
      site.signupLink,
      site.headerCta,
    ];

    for (const link of links) {
      if (!link.href.startsWith("/")) continue;
      assert.ok(rotaExiste(link.href), `${locale}: "${link.label}" -> ${link.href}`);
    }
  }
});

test("nenhum link do conteúdo aponta para uma âncora de home que não existe mais", () => {
  // As páginas internas em inglês substituíram as âncoras /en#sobre, /en#livros
  // etc. Se alguma voltar, o menu em inglês volta a rolar a home em vez de
  // abrir a página.
  for (const locale of IDIOMAS) {
    for (const { href, onde } of coletarHrefs(siteContent[locale])) {
      assert.ok(!href.startsWith("/en#"), `${locale}.${onde} ainda usa âncora antiga: ${href}`);
    }
  }
});
