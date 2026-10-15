/**
 * =============================================================================
 *  TESTE DE REGRESSÃO — revelação de conteúdo em navegação CLIENT-SIDE
 * =============================================================================
 *
 *  POR QUE ESTE TESTE EXISTE
 *  -------------------------
 *  `RevealObserver` montava um IntersectionObserver com `useEffect(..., [])`.
 *  Ele vive no layout persistente, então esse efeito rodava UMA vez, na
 *  primeira montagem, e varria `[data-reveal]` só naquele instante.
 *
 *  Numa navegação client-side do App Router o layout não remonta: só o
 *  conteúdo troca. Os elementos da página nova entravam no DOM depois da
 *  varredura e nunca eram observados. Como o CSS mantém `[data-reveal]` em
 *  `opacity: 0` até ganhar `data-revealed`, a página inteira ficava invisível
 *  — com a altura ocupada, o que produzia "uma grande área vazia".
 *
 *  Recarregar a página escondia o defeito, porque aí o layout remontava.
 *
 *  POR QUE NÃO É UM TESTE UNITÁRIO
 *  -------------------------------
 *  O defeito só existe na combinação de três coisas reais: o roteador do Next
 *  preservando o layout, o IntersectionObserver do navegador e o CSS. Um teste
 *  que checasse "a rota existe" ou "o texto está no código" passaria com o bug
 *  presente — o conteúdo SEMPRE esteve no HTML; o que faltava era a classe de
 *  revelação. Só um navegador de verdade, navegando pelos links, prova a
 *  correção.
 *
 *  DEPENDÊNCIAS: nenhuma nova. Fala CDP direto pelo `WebSocket` global do
 *  Node 22+ e usa o Chrome já instalado. Nada de Playwright/Puppeteer só para
 *  isto.
 *
 *  COMO RODAR
 *  ----------
 *      npm run build && npm run start      (num terminal)
 *      npm run test:e2e                    (noutro)
 *
 *  A REGRA QUE FAZ ESTE TESTE FALHAR SE O BUG VOLTAR: depois de cada
 *  navegação feita por CLIQUE (nunca por URL, nunca com reload), nenhum
 *  elemento `[data-reveal]` visível na viewport pode continuar com
 *  `opacity: 0`.
 * =========================================================================== */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME =
  process.env.CHROME_PATH ??
  String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * =============================================================================
 *  O CATÁLOGO DEIXOU DE SER UM FATO DO CÓDIGO
 * =============================================================================
 *
 *  Este teste afirmava "os seis cards de livro estão na página". Era verdade
 *  enquanto os livros viviam em `src/content/site.ts`: seis era uma constante,
 *  e conferir isso conferia o código.
 *
 *  Agora os livros vêm do banco, e quantos existem é decisão do painel. No CI
 *  não há banco — as variáveis do Supabase são fictícias de propósito —, e a
 *  afirmação passou a falhar num sistema que está correto: `0 links`.
 *
 *  A saída NÃO é afrouxar para `>= 0`, que passaria em qualquer situação e
 *  deixaria de detectar um catálogo vazio em produção. É declarar o modo:
 *
 *    E2E_SEM_BANCO=1 → exige catálogo VAZIO. É o CI, e a asserção passa a
 *                      provar que a vitrine sobe sem banco em vez de quebrar.
 *    sem a variável   → exige pelo menos um livro, e que TODOS abram por
 *                      clique com o conteúdo visível.
 *
 *  Os dois modos afirmam algo real. O número exato de livros e a integridade
 *  de cada um são verificados onde o dado está: `npm run test:db`.
 * =========================================================================== */
const SEM_BANCO = process.env.E2E_SEM_BANCO === "1";
const PORT = 9610;

let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "OK   " : "FALHA"} ${label}${extra ? `  → ${extra}` : ""}`);
};

/* ---------------------------------- CDP ----------------------------------- */

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.next\\_e2enav`,
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
  console.log("Não consegui abrir o Chrome. Defina CHROME_PATH se ele estiver noutro lugar.");
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

/**
 * Igual ao `js`, mas espera a Promise resolver. Sem `awaitPromise` o CDP
 * devolve o objeto Promise em si, não o valor — e a asserção compara com
 * `undefined` achando que mediu alguma coisa.
 */
const jsAsync = async (expressao) =>
  (
    await cdp("Runtime.evaluate", {
      expression: expressao,
      returnByValue: true,
      awaitPromise: true,
    })
  ).result?.result?.value;

async function ate(expressao, ms = 12000) {
  for (let i = 0; i < ms / 250; i++) {
    if (await js(expressao)) return true;
    await sleep(250);
  }
  return false;
}

const viewport = (width, height) =>
  cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });

/** Carga completa — usada UMA vez, só para entrar no site. */
async function abrir(caminho) {
  await cdp("Page.navigate", { url: `${BASE}${caminho}` });
  await ate("document.readyState === 'complete'");
  await sleep(800);
}

/**
 * Navega CLICANDO num link interno, que é o caminho onde o defeito aparecia.
 * Confirma que a URL mudou sem recarregar: `performance.getEntriesByType(
 * 'navigation')` continua com uma entrada só.
 */
async function clicarEm(href) {
  const antes = await js("location.pathname");
  const achou = await js(`(() => {
    const alvo = [...document.querySelectorAll('a[href]')]
      .find(a => a.getAttribute('href') === ${JSON.stringify(href)});
    if (!alvo) return false;
    alvo.click();
    return true;
  })()`);
  if (!achou) return { ok: false, motivo: `nenhum link para ${href} nesta página` };

  const mudou = await ate(`location.pathname !== ${JSON.stringify(antes)}`, 12000);
  if (!mudou) return { ok: false, motivo: `a URL não mudou de ${antes}` };

  await ate("document.readyState === 'complete'");
  await sleep(900);
  return { ok: true };
}

/**
 * O coração do teste.
 *
 * Percorre TODO `[data-reveal]` da página, rola até cada um e devolve os que
 * continuam invisíveis. Rolar é essencial: a revelação é por interseção, então
 * um elemento fora da viewport está legitimamente em opacity 0 — o defeito é
 * ele continuar assim DEPOIS de entrar em tela.
 */
async function presosInvisiveis() {
  return jsAsync(`(async () => {
    const nodes = [...document.querySelectorAll('[data-reveal]')];
    if (nodes.length === 0) return { total: 0, presos: [] };

    const espera = (ms) => new Promise(r => setTimeout(r, ms));
    const presos = [];

    for (const node of nodes) {
      node.scrollIntoView({ block: 'center', behavior: 'instant' });
      await espera(120);
      const opacidade = Number(getComputedStyle(node).opacity);
      if (opacidade < 0.95) {
        // Segunda chance: a transição dura 600ms e pode ter delay de stagger.
        await espera(900);
        if (Number(getComputedStyle(node).opacity) < 0.95) {
          presos.push((node.tagName + '.' + (node.className || '')).slice(0, 70));
        }
      }
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
    return { total: nodes.length, presos };
  })()`);
}

/** Roda `presosInvisiveis` e transforma em asserção. */
async function conteudoVisivel(rotulo) {
  const r = await presosInvisiveis();
  const caminho = await js("location.pathname");
  check(
    r && r.presos.length === 0,
    `${rotulo} — ${r?.total ?? 0} elementos revelados`,
    r?.presos?.length ? `presos em ${caminho}: ${r.presos.slice(0, 3).join(" | ")}` : "",
  );
  return r;
}

/** Só uma entrada de navegação = nenhum hard refresh aconteceu no trajeto. */
const navegacoesDoNavegador = () =>
  js("performance.getEntriesByType('navigation').length");

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");

/* -------------------------------- roteiro --------------------------------- */

try {
  console.log(`\n=== Navegação client-side — ${BASE} ===\n`);
  await viewport(1440, 1000);

  /* ------------------------------------------------------------------ 1 --- */
  console.log("Trajeto 1 · Home → Livros → detalhe → logo → Home\n");
  await abrir("/");
  await conteudoVisivel("home (carga direta)");
  const caminhosPt = await js(`Boolean(
    document.querySelector('#caminhos') &&
    document.querySelector('a[href="#caminhos"]') &&
    document.querySelectorAll('#caminhos ol > li').length === 3
  )`);
  check(caminhosPt, "home PT renderiza os três caminhos e a âncora do hero");

  const paraLivros = await clicarEm("/livros");
  check(paraLivros.ok, "clique no menu leva a /livros", paraLivros.motivo ?? "");
  await conteudoVisivel("/livros por clique");

  const cards = await js(`
    [...document.querySelectorAll('a[href^="/livros/"]')]
      .map(a => a.getAttribute('href'))
      .filter((h, i, todos) => todos.indexOf(h) === i).length
  `);
  check(
    SEM_BANCO ? cards === 0 : cards >= 1,
    SEM_BANCO
      ? "sem banco, o catálogo abre vazio em vez de quebrar"
      : "o catálogo lista livros, e cada um é um link",
    `${cards} links`,
  );

  /* TODAS as páginas de livro, não uma amostra: o brief pede cada
     /livros/[slug]. Volta pelo histórico entre uma e outra — continua sendo
     navegação client-side. */
  const slugs = await js(`
    [...document.querySelectorAll('a[href^="/livros/"]')]
      .map(a => a.getAttribute('href'))
      .filter((h, i, todos) => todos.indexOf(h) === i)
  `);
  let detalhesOk = 0;
  const detalhesPresos = [];
  for (const href of slugs) {
    const r = await clicarEm(href);
    if (!r.ok) {
      detalhesPresos.push(`${href}: ${r.motivo}`);
      continue;
    }
    const medida = await presosInvisiveis();
    if (medida && medida.presos.length === 0) detalhesOk += 1;
    else detalhesPresos.push(`${href}: ${medida?.presos?.length ?? "?"} presos`);
    await cdp("Runtime.evaluate", { expression: "history.back()" });
    await sleep(1600);
    await ate("document.readyState === 'complete'");
  }
  check(
    detalhesOk === slugs.length && (SEM_BANCO ? slugs.length === 0 : slugs.length >= 1),
    SEM_BANCO
      ? "sem banco, não há página de livro para abrir"
      : `os ${slugs.length} livros abrem por clique com o conteúdo visível`,
    detalhesPresos.slice(0, 3).join(" | "),
  );
  await conteudoVisivel("/livros depois de voltar do último detalhe");

  const paraHome = await clicarEm("/");
  check(paraHome.ok, "a logo volta para a home", paraHome.motivo ?? "");
  await conteudoVisivel("home de volta, por clique");

  check(
    (await navegacoesDoNavegador()) === 1,
    "o trajeto inteiro foi client-side, sem nenhum reload",
    `entradas de navigation: ${await navegacoesDoNavegador()}`,
  );

  /* ------------------------------------------------------------------ 2 --- */
  console.log("\nTrajeto 2 · Home → Sobre → Consultoria → Ghostwriting → logo\n");
  for (const [href, rotulo] of [
    ["/sobre", "/sobre"],
    ["/consultoria", "/consultoria"],
    ["/ghostwriting", "/ghostwriting"],
    ["/curso", "/curso"],
  ]) {
    const r = await clicarEm(href);
    check(r.ok, `clique leva a ${rotulo}`, r.motivo ?? "");
    if (r.ok) await conteudoVisivel(`${rotulo} por clique`);
  }
  const voltaHome2 = await clicarEm("/");
  check(voltaHome2.ok, "logo volta para a home (trajeto 2)", voltaHome2.motivo ?? "");
  await conteudoVisivel("home (trajeto 2)");

  /* ------------------------------------------------------------------ 3 --- */
  console.log("\nTrajeto 3 · Português → inglês → internas → logo\n");
  const paraEn = await clicarEm("/en");
  check(paraEn.ok, "o seletor de idioma leva a /en", paraEn.motivo ?? "");
  await conteudoVisivel("/en por clique");
  const caminhosEn = await js(`Boolean(
    document.querySelector('#paths') &&
    document.querySelector('a[href="#paths"]') &&
    document.querySelectorAll('#paths ol > li').length === 3
  )`);
  check(caminhosEn, "home EN renderiza os três paths e a âncora do hero");

  for (const href of ["/en/about", "/en/books", "/en/consulting", "/en/ghostwriting", "/en/course"]) {
    const r = await clicarEm(href);
    check(r.ok, `clique leva a ${href}`, r.motivo ?? "");
    if (r.ok) await conteudoVisivel(`${href} por clique`);
  }

  await clicarEm("/en/books");
  const notasCatalogoEn = await js(`(() => {
    const texto = document.querySelector('main')?.textContent ?? '';
    return texto.includes('Original titles in Portuguese.') &&
      texto.includes('Approximate USD values converted at R$ 5.10 per US$ 1.');
  })()`);
  check(
    notasCatalogoEn,
    "catálogo EN explica os títulos oficiais e os preços aproximados",
  );
  const slugsEn = await js(`
    [...document.querySelectorAll('a[href^="/en/books/"]')]
      .map(a => a.getAttribute('href'))
      .filter((h, i, todos) => todos.indexOf(h) === i)
  `);
  let detalhesEnOk = 0;
  const detalhesEnPresos = [];
  for (const href of slugsEn) {
    const r = await clicarEm(href);
    if (!r.ok) {
      detalhesEnPresos.push(`${href}: ${r.motivo}`);
      continue;
    }
    const medida = await presosInvisiveis();
    if (medida && medida.presos.length === 0) detalhesEnOk += 1;
    else detalhesEnPresos.push(`${href}: ${medida?.presos?.length ?? "?"} presos`);
    await cdp("Runtime.evaluate", { expression: "history.back()" });
    await sleep(1600);
    await ate("document.readyState === 'complete'");
  }
  check(
    detalhesEnOk === slugsEn.length && (SEM_BANCO ? slugsEn.length === 0 : slugsEn.length >= 1),
    SEM_BANCO
      ? "sem banco, não há página de livro em inglês para abrir"
      : `os ${slugsEn.length} livros em inglês abrem por clique com o conteúdo visível`,
    detalhesEnPresos.slice(0, 3).join(" | "),
  );

  const voltaHomeEn = await clicarEm("/en");
  check(voltaHomeEn.ok, "a logo em inglês volta para /en", voltaHomeEn.motivo ?? "");
  check(
    (await js("location.pathname")) === "/en",
    "a logo em inglês NÃO cai na home em português",
    await js("location.pathname"),
  );
  await conteudoVisivel("/en de volta");

  /* ------------------------------------------------------------------ 4 --- */
  console.log("\nTrajeto 4 · voltar e avançar do navegador\n");
  await cdp("Runtime.evaluate", { expression: "history.back()" });
  await sleep(1800);
  await ate("document.readyState === 'complete'");
  await conteudoVisivel(`voltar → ${await js("location.pathname")}`);

  await cdp("Runtime.evaluate", { expression: "history.forward()" });
  await sleep(1800);
  await ate("document.readyState === 'complete'");
  await conteudoVisivel(`avançar → ${await js("location.pathname")}`);

  /* ------------------------------------------------------------------ 5 --- */
  console.log("\nTrajeto 5 · menu mobile aberto → página interna → logo\n");
  await viewport(390, 844);
  await abrir("/");

  const abriuMenu = await js(`(() => {
    const botao = [...document.querySelectorAll('button')]
      .find(b => /menu|abrir/i.test(b.getAttribute('aria-label') || b.innerText || ''));
    if (!botao) return false;
    botao.click();
    return true;
  })()`);
  check(abriuMenu, "o botão do menu mobile existe e abre");
  await sleep(700);

  const paraSobreMobile = await clicarEm("/sobre");
  check(paraSobreMobile.ok, "pelo menu mobile chega em /sobre", paraSobreMobile.motivo ?? "");
  await conteudoVisivel("/sobre em 390px");

  // A logo dentro do menu: abre o menu de novo e clica nela.
  await js(`(() => {
    const botao = [...document.querySelectorAll('button')]
      .find(b => /menu|abrir/i.test(b.getAttribute('aria-label') || b.innerText || ''));
    botao?.click();
  })()`);
  await sleep(700);
  const logoNoMenu = await clicarEm("/");
  check(logoNoMenu.ok, "a logo dentro do menu mobile leva à home", logoNoMenu.motivo ?? "");
  const menuFechado = await js(`
    !document.querySelector('[aria-expanded="true"]')
  `);
  check(menuFechado, "o menu fecha ao navegar pela logo");
  await conteudoVisivel("home em 390px depois do menu");

  /* ------------------------------------------------------------------ 6 --- */
  console.log("\n6 · Posição de rolagem e overflow nas quatro larguras\n");
  for (const [w, h] of [
    [1920, 1080],
    [1440, 1000],
    [768, 1024],
    [390, 844],
  ]) {
    await viewport(w, h);
    await abrir("/");
    const homeEstoura = await js(
      "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1",
    );
    check(!homeEstoura, `${w}px: sem overflow horizontal na home`);
    // Rola para o meio e navega: a página nova tem que começar no topo.
    await js("window.scrollTo({ top: 1200, behavior: 'instant' })");
    await sleep(300);
    const ida = await clicarEm("/sobre");
    const topo = await js("Math.round(window.scrollY)");
    check(ida.ok && topo <= 4, `${w}px: a página nova abre no topo`, `scrollY=${topo}`);

    const estoura = await js(
      "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1",
    );
    check(!estoura, `${w}px: sem overflow horizontal em /sobre`);
  }

  /* ------------------------------------------------------------------ 7 --- */
  console.log("\n7 · Autenticação bilíngue e proteção de rotas\n");
  await viewport(390, 844);
  await abrir("/entrar?locale=en");
  check((await js("document.documentElement.lang")) === "en-US", "login EN declara en-US");
  check(await ate("document.body.innerText.toLowerCase().includes('log in')"), "login EN renderiza Log In");

  const paraRecuperar = await clicarEm("/recuperar-senha");
  check(paraRecuperar.ok, "login leva à recuperação por navegação client-side", paraRecuperar.motivo ?? "");
  check(await ate("document.body.innerText.toLowerCase().includes('reset password')"), "recuperação preserva inglês");

  await abrir("/cadastro");
  check((await js("document.documentElement.lang")) === "en-US", "cadastro preserva locale EN no cookie");
  check(await ate("document.body.innerText.toLowerCase().includes('sign up')"), "cadastro EN renderiza Sign Up");

  await abrir("/entrar?locale=pt");
  check((await js("document.documentElement.lang")) === "pt-BR", "login PT declara pt-BR");
  check(await ate("document.body.innerText.toLowerCase().includes('entrar')"), "login PT renderiza Entrar");

  await abrir("/aluno");
  check(
    (await js("location.pathname")) === "/entrar" && (await js("new URLSearchParams(location.search).get('next')")) === "/aluno",
    "aluno anônimo é enviado ao login com destino seguro",
  );
  await abrir("/admin");
  check(
    (await js("location.pathname")) === "/entrar" && (await js("new URLSearchParams(location.search).get('next')")) === "/admin",
    "admin anônimo é enviado ao login com destino seguro",
  );

  /* ------------------------------------------------------------------ 8 --- */
  console.log("\n8 · Console e rede\n");
  const errosReais = errosConsole.filter((e) => !/favicon|DevTools/i.test(e));
  const ruinsReais = respostasRuins.filter((r) => !/favicon|\.map$/i.test(r));
  check(errosReais.length === 0, "nenhum erro de console", errosReais.slice(0, 3).join(" | "));
  check(ruinsReais.length === 0, "nenhuma resposta HTTP >= 400", ruinsReais.slice(0, 3).join(" | "));
} catch (erro) {
  fail++;
  console.log(`\n  ERRO: ${erro.message}`);
} finally {
  ws.close();
  chrome.kill();
  console.log(`\n=== ${pass} ok, ${fail} falha(s) ===`);
}

process.exit(fail === 0 ? 0 : 1);
