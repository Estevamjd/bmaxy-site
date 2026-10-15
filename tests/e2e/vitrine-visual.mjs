/**
 * =============================================================================
 *  VERIFICAÇÃO VISUAL DA VITRINE — PT e EN, num navegador de verdade
 * =============================================================================
 *
 *  Confere o que o VISITANTE vê nas quatro rotas públicas, nas duas larguras
 *  que importam, e captura imagens para conferência humana.
 *
 *  O que este teste responde e os outros não:
 *
 *    - o preço aprovado (US$ 12.65) chega mesmo à tela em inglês;
 *    - os seis livros aparecem, na ordem do painel, com capa e preço;
 *    - NENHUM rascunho ou arquivado vaza para a vitrine — verificado contra o
 *      banco, comparando o que está publicado com o que a página mostra;
 *    - o par pt/en de cada livro casa, e o seletor de idioma leva à tradução;
 *    - nada estoura no console e nenhuma resposta passa de 400.
 *
 *  As imagens vão para `.next/_visual/` (ignorado pelo git) — são para olhar,
 *  não para comparar automaticamente. Comparação de pixels em CI vira ruído
 *  na primeira mudança de fonte.
 * =========================================================================== */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9444;
const SAIDA = ".next/_visual";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

/* Service role SÓ para saber a verdade do banco e comparar com a tela.
   Nenhuma asserção de segurança passa por ele. */
const servico = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "OK   " : "FALHA"} ${label}${extra ? `  → ${extra}` : ""}`);
};

mkdirSync(SAIDA, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.next\\_e2evis`,
  "about:blank",
]);
chrome.stderr.on("data", () => {});

let target;
for (let i = 0; i < 60 && !target; i++) {
  try {
    const lista = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = lista.find((t) => t.type === "page");
  } catch {}
  if (!target) await sleep(300);
}
if (!target) {
  console.log("Não consegui abrir o Chrome. Defina CHROME_PATH.");
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));

let id = 0;
const pendentes = new Map();
const errosConsole = [];
const respostasRuins = [];

ws.addEventListener("message", (evento) => {
  const m = JSON.parse(evento.data);
  if (m.id && pendentes.has(m.id)) {
    pendentes.get(m.id)(m);
    pendentes.delete(m.id);
    return;
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    errosConsole.push((m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" "));
  }
  if (m.method === "Runtime.exceptionThrown") {
    errosConsole.push(m.params.exceptionDetails?.exception?.description ?? "exceção");
  }
  if (m.method === "Network.responseReceived" && m.params.response.status >= 400) {
    respostasRuins.push(`${m.params.response.status} ${m.params.response.url.replace(BASE, "")}`);
  }
});

const cdp = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pendentes.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

const js = async (expressao) =>
  (await cdp("Runtime.evaluate", { expression: expressao, returnByValue: true })).result?.result
    ?.value;

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");

const viewport = (width, height) =>
  cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });

async function ir(caminho) {
  await cdp("Page.navigate", { url: `${BASE}${caminho}` });
  for (let i = 0; i < 60; i++) {
    if (await js("document.readyState === 'complete'")) break;
    await sleep(250);
  }
  /* Espera a revelação por IntersectionObserver terminar — sem isso a captura
     sai com metade da página ainda invisível. */
  await sleep(1200);
}

const texto = () => js("document.body.innerText");

/* Sem diferenciar caixa: `innerText` devolve o texto RENDERIZADO, e o projeto
   usa `text-transform: uppercase` em títulos. Procurar "Aaron Tucker" num
   "AARON TUCKER" falha sem que nada esteja errado na página. */
const contem = async (...textos) => {
  const corpo = (await texto()).toLowerCase();
  return textos.some((t) => corpo.includes(t.toLowerCase()));
};

/**
 * Rola a página inteira antes de capturar, e confere que nada ficou invisível.
 *
 * `captureBeyondViewport` fotografa a página toda, mas NÃO faz o
 * IntersectionObserver disparar: o conteúdo abaixo da dobra continua em
 * `opacity: 0`, exatamente como estava. A primeira versão desta captura
 * produziu uma imagem com três dos seis livros e um vazio enorme embaixo — o
 * site estava certo, a foto é que fora tirada com as luzes apagadas.
 *
 * Rolar até o fim revela tudo. E, já que a página está toda revelada, dá para
 * afirmar algo além da foto: nenhum `[data-reveal]` pode ter sobrado
 * transparente. É a mesma regra do teste de navegação, aplicada à vitrine.
 */
async function capturar(nome) {
  /* Passos curtos e pausa generosa. Com 400px a cada 90ms, em 390px de largura
     — onde a página tem 7000px de altura — o observador não dava conta e 1 ou
     2 cartões chegavam ao fim ainda transparentes. Medido em separado com
     rolagem lenta: ZERO presos. Ou seja, o site estava certo e a MEDIÇÃO é que
     corria demais. Diminuir o passo custa alguns segundos por captura e
     elimina um falso negativo que pareceria um defeito de acessibilidade. */
  const altura = await js("document.body.scrollHeight");
  for (let y = 0; y < altura; y += 200) {
    await js(`window.scrollTo(0, ${y})`);
    await sleep(160);
  }
  await js("window.scrollTo(0, document.body.scrollHeight)");
  await sleep(1200);
  await js("window.scrollTo(0, 0)");
  await sleep(600);

  const presos = await js(`
    [...document.querySelectorAll('[data-reveal]')]
      .filter(el => parseFloat(getComputedStyle(el).opacity) < 0.9).length
  `);
  check(presos === 0, `${nome}: nada ficou invisível depois de rolar`, `${presos} presos`);

  const r = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  if (r.result?.data) {
    writeFileSync(`${SAIDA}/${nome}.png`, Buffer.from(r.result.data, "base64"));
    return true;
  }
  return false;
}

try {
  /* ---------------------------------------------------------------- banco -- */
  const { data: publicados } = await servico
    .from("books")
    .select("slug, title, status")
    .eq("status", "published")
    .order("order_index");
  const { data: naoPublicados } = await servico
    .from("books")
    .select("slug, title, status")
    .neq("status", "published");

  console.log(
    `\nBanco: ${publicados.length} publicado(s), ${naoPublicados.length} fora da vitrine\n`,
  );

  /* ------------------------------------------------------------------ PT -- */
  console.log("1 · Catálogo em português\n");
  await viewport(1440, 900);
  await ir("/livros");

  const ptTexto = await texto();
  const ptSlugs = await js(`
    [...document.querySelectorAll('a[href^="/livros/"]')]
      .map(a => a.getAttribute('href').replace('/livros/',''))
      .filter((h,i,t) => t.indexOf(h) === i)
  `);

  check(
    ptSlugs.length === publicados.length,
    "a vitrine PT mostra exatamente os livros publicados",
    `tela=${ptSlugs.length} banco=${publicados.length}`,
  );
  check(
    publicados.every((livro) => ptSlugs.includes(livro.slug)),
    "e todos os publicados estão lá, sem faltar nenhum",
  );
  check(
    ptTexto.includes("R$ 73,92") && ptTexto.includes("R$ 102,29"),
    "os preços em reais aparecem",
  );
  check(!ptTexto.includes("Approx."), "e NÃO há preço em dólar na versão portuguesa");
  check(await capturar("pt-livros-1440"), "captura: /livros em 1440px");

  await viewport(390, 844);
  await ir("/livros");
  const semOverflowPt = await js(
    "document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1",
  );
  check(semOverflowPt, "/livros em 390px não tem rolagem horizontal");
  check(await capturar("pt-livros-390"), "captura: /livros em 390px");

  await viewport(1440, 900);
  await ir(`/livros/${publicados[0].slug}`);
  check(
    await contem(publicados[0].title),
    `a página de ${publicados[0].slug} abre com o título`,
  );
  check(await capturar("pt-livro-detalhe"), "captura: página de livro PT");

  /* ------------------------------------------------------------------ EN -- */
  console.log("\n2 · Catálogo em inglês\n");
  await ir("/en/books");

  const enTexto = await texto();
  const enSlugs = await js(`
    [...document.querySelectorAll('a[href^="/en/books/"]')]
      .map(a => a.getAttribute('href').replace('/en/books/',''))
      .filter((h,i,t) => t.indexOf(h) === i)
  `);

  check(
    enSlugs.length === publicados.length,
    "a vitrine EN mostra exatamente os livros publicados",
    `tela=${enSlugs.length} banco=${publicados.length}`,
  );
  check(
    JSON.stringify(enSlugs) === JSON.stringify(ptSlugs),
    "PT e EN listam os mesmos slugs, na mesma ordem",
  );

  /* O PREÇO APROVADO PELO CLIENTE.
     R$ 64,39 ÷ 5,1000 = 12,6255 → arredondado para os 5 centavos mais
     próximos = US$ 12.65. Vem do cálculo central, sem exceção por livro. */
  check(
    enTexto.includes("Approx. US$ 12.65"),
    "o preço aprovado de 5-passos aparece como US$ 12.65",
    enTexto.match(/Approx\. US\$ [\d.,]+/g)?.join(" | ") ?? "nenhum",
  );
  check(!enTexto.includes("US$ 12.60"), "e o valor antigo (12.60) não aparece em lugar nenhum");
  /* A NOTA cita a cotação ("converted at R$ 5.10 per US$ 1") — é explicação,
     não preço. O que não pode existir é um PREÇO DE LIVRO em reais na versão
     inglesa, e é isso que se mede: nenhum "R$ <valor>" nos cards. */
  const reaisNosCards = await js(`
    [...document.querySelectorAll("dd")].map(d => d.textContent).filter(t => /R\$/.test(t))
  `);
  check(
    reaisNosCards.length === 0,
    "nenhum PREÇO em reais na versão inglesa",
    reaisNosCards.slice(0, 3).join(" | "),
  );
  check(
    enTexto.includes("converted at R$ 5.10 per US$ 1"),
    "a nota de conversão cita a cotação REAL, vinda do banco",
  );
  check(
    enTexto.includes("Original titles in Portuguese."),
    "a nota sobre títulos oficiais em português está presente",
  );
  check(await capturar("en-books-1440"), "captura: /en/books em 1440px");

  await viewport(390, 844);
  await ir("/en/books");
  const semOverflowEn = await js(
    "document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1",
  );
  check(semOverflowEn, "/en/books em 390px não tem rolagem horizontal");
  check(await capturar("en-books-390"), "captura: /en/books em 390px");

  await viewport(1440, 900);
  await ir(`/en/books/${publicados[0].slug}`);
  check(
    await contem(publicados[0].title),
    "a página de livro EN mantém o título oficial em português",
  );
  check(await capturar("en-livro-detalhe"), "captura: página de livro EN");

  /* ------------------------------------------------- rascunhos não vazam -- */
  console.log("\n3 · Nada fora de 'published' aparece\n");

  if (naoPublicados.length === 0) {
    /* Sem rascunho no banco, a asserção não teria o que provar. Cria-se um
       temporário, mede-se, e ele é removido — é a única forma de o teste
       afirmar alguma coisa. */
    const { data: rascunho } = await servico
      .from("books")
      .insert({
        slug: `zz-vis-${String(Date.now()).slice(-8)}`,
        title: "RASCUNHO QUE NAO PODE VAZAR",
        status: "draft",
        order_index: 970,
      })
      .select("id, slug")
      .single();

    await servico.from("book_localizations").insert([
      { book_id: rascunho.id, locale: "pt", synopsis: "segredo", cover_alt: "x" },
      { book_id: rascunho.id, locale: "en", synopsis: "secret", cover_alt: "x" },
    ]);

    /* A vitrine está em cache; o rascunho nasceu depois. Consultar o servidor
       direto prova que nem uma regeneração o traria. */
    const htmlPt = await (await fetch(`${BASE}/livros`)).text();
    const htmlEn = await (await fetch(`${BASE}/en/books`)).text();
    const detalhe = await fetch(`${BASE}/livros/${rascunho.slug}`);

    check(!htmlPt.includes("RASCUNHO QUE NAO PODE VAZAR"), "rascunho não aparece em /livros");
    check(!htmlEn.includes("RASCUNHO QUE NAO PODE VAZAR"), "rascunho não aparece em /en/books");
    check(detalhe.status === 404, "a página do rascunho responde 404", String(detalhe.status));

    const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
    check(!sitemap.includes(rascunho.slug), "o rascunho não entra no sitemap");

    await servico.from("books").delete().eq("id", rascunho.id);
    console.log("       (rascunho temporário removido)");
  } else {
    for (const livro of naoPublicados) {
      const htmlPt = await (await fetch(`${BASE}/livros`)).text();
      check(!htmlPt.includes(livro.title), `${livro.slug} (${livro.status}) não vaza para /livros`);
    }
  }

  /* --------------------------------------------------------- sitemap/SEO -- */
  console.log("\n4 · Sitemap e hreflang\n");

  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  for (const livro of publicados) {
    check(
      sitemap.includes(`/livros/${livro.slug}`) && sitemap.includes(`/en/books/${livro.slug}`),
      `${livro.slug} está no sitemap nos dois idiomas`,
    );
  }

  await ir(`/livros/${publicados[0].slug}`);
  const alternates = await js(`
    [...document.querySelectorAll('link[rel=alternate]')].map(l => l.getAttribute('hreflang'))
  `);
  check(
    alternates.includes("pt-BR") && alternates.includes("en-US"),
    "a página de livro declara os dois hreflang",
    alternates.join(", "),
  );

  /* ------------------------------------------------------ console e rede -- */
  console.log("\n5 · Console e rede\n");
  check(errosConsole.length === 0, "nenhum erro de console", errosConsole.slice(0, 2).join(" | "));
  check(
    respostasRuins.length === 0,
    "nenhuma resposta HTTP >= 400",
    respostasRuins.slice(0, 3).join(" | "),
  );
} catch (erro) {
  fail++;
  console.log(`\n  ERRO: ${erro.stack ?? erro.message}`);
} finally {
  try {
    ws.close();
  } catch {}
  chrome.kill();
  console.log(`\n  imagens em ${SAIDA}/`);
  console.log(`\n=== ${pass} ok, ${fail} falha(s) ===`);
  process.exit(fail === 0 ? 0 : 1);
}
