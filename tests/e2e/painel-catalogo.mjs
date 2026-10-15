/**
 * =============================================================================
 *  PAINEL DE LIVROS — o fluxo inteiro, num navegador de verdade
 * =============================================================================
 *
 *  Os testes de `tests/db/` provam a fronteira do banco. Este prova o que
 *  eles NÃO conseguem provar: que as Server Actions escrevem, que a
 *  revalidação acontece e que a vitrine muda por causa disso.
 *
 *  É a diferença entre "a policy está certa" e "a funcionalidade funciona".
 *  Uma action pode ter `requireAdmin()` impecável, gravar corretamente e
 *  mesmo assim a página pública continuar servindo a versão antiga do cache
 *  para sempre — e nenhum teste de RLS perceberia.
 *
 *  O QUE ESTE TESTE FAZ, EM ORDEM
 *  ---------------------------------------------------------------------------
 *    1. entra como administrador de verdade (formulário, senha, cookie)
 *    2. cria um livro pelo painel
 *    3. preenche preço, sinopses e links pelo formulário
 *    4. confirma que ele NÃO aparece na vitrine enquanto é rascunho
 *    5. publica e confirma que aparece — em pt e em en
 *    6. confere a conversão para dólar na página em inglês
 *    7. muda a cotação e confirma que TODOS os preços em dólar mudam
 *    8. arquiva e confirma que sai da vitrine
 *    9. desfaz tudo: cotação de volta a 5,1000 e livro de teste removido
 *
 *  PRECISA DE UM SERVIDOR EM PRODUÇÃO (`npm run build && npm start`), não do
 *  `next dev`: o que está sendo medido é o cache, e em desenvolvimento ele
 *  não existe da mesma forma. Um teste que passasse no `dev` não diria nada
 *  sobre o que o visitante recebe.
 * =========================================================================== */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ler = (arquivo) =>
  Object.fromEntries(
    readFileSync(arquivo, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );

const env = ler(".env.local");
const cred = ler(".env.admin-credentials.local");

/* O service_role serve para LIMPAR e para conferir por fora. Nenhuma ação do
   teste passa por ele — tudo é feito pela interface, como o cliente faria. */
const servico = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "OK   " : "FALHA"} ${label}${extra ? `  → ${extra}` : ""}`);
};

const stamp = String(Date.now()).slice(-8);
const SLUG = `zz-e2e-${stamp}`;
const TITULO = `Livro E2E ${stamp}`;

/* ---------------------------------- CDP ----------------------------------- */

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}\\.next\\_e2ecat`,
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
ws.addEventListener("message", (evento) => {
  const m = JSON.parse(evento.data);
  if (m.id && pendentes.has(m.id)) {
    pendentes.get(m.id)(m);
    pendentes.delete(m.id);
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

async function ir(caminho) {
  await cdp("Page.navigate", { url: `${BASE}${caminho}` });
  for (let i = 0; i < 60; i++) {
    if (await js("document.readyState === 'complete'")) break;
    await sleep(250);
  }
  await sleep(600);
}

/** Espera uma condição virar verdadeira. Devolve false se estourar o tempo. */
async function ate(expressao, ms = 15000) {
  for (let i = 0; i < ms / 250; i++) {
    if (await js(expressao)) return true;
    await sleep(250);
  }
  return false;
}

const texto = () => js("document.body.innerText");

/**
 * Comparação de texto que ignora caixa.
 *
 * `innerText` devolve o texto COMO RENDERIZADO, e o projeto usa
 * `text-transform: uppercase` em vários rótulos e títulos. Procurar
 * "Livro E2E 12345678" num texto que o navegador entrega como
 * "LIVRO E2E 12345678" falha sem que nada esteja errado na página — foi
 * exatamente isso que produziu quatro falsos negativos na primeira rodada
 * deste teste, incluindo um alarmante "a revalidação não aconteceu".
 */
const contem = async (...textos) => {
  const corpo = (await texto()).toLowerCase();
  return textos.some((t) => corpo.includes(t.toLowerCase()));
};

/**
 * Preenche um campo do jeito que o React enxerga.
 *
 * `input.value = x` não dispara o setter nativo que o React observa, e o
 * estado do componente continua com o valor antigo — o formulário envia o que
 * estava lá antes. O `nativeInputValueSetter` é o contorno conhecido.
 */
const preencher = (seletor, valor) =>
  js(`(() => {
    const el = document.querySelector(${JSON.stringify(seletor)});
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(valor)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);

/**
 * Clica no botão cujo texto bate — em QUALQUER um dos dois idiomas.
 *
 * O painel é bilíngue e segue o idioma do PERFIL do administrador, não o da
 * URL. O administrador real deste projeto usa o painel em inglês, e a
 * primeira versão deste teste procurava só os rótulos em português: ela
 * "falhava" num painel que estava perfeitamente correto.
 *
 * Aceitar os dois idiomas conserta o teste e, de quebra, passa a verificar
 * que cada rótulo existe traduzido — se alguém acrescentar um botão só em
 * português, o teste em inglês para de achá-lo.
 */
const clicarBotao = (...rotulos) =>
  js(`(() => {
    const alvos = ${JSON.stringify(rotulos.map((r) => r.toLowerCase()))};
    const alvo = [...document.querySelectorAll('button, [role=button]')]
      .find(b => alvos.includes(b.innerText.trim().toLowerCase()));
    if (!alvo) return false;
    alvo.click();
    return true;
  })()`);

const contemAlgum = contem;

let livroId = null;

try {
  /* ======================================================================= */
  console.log("\n1. Entrar como administrador\n");
  /* ======================================================================= */

  await ir("/entrar");

  await preencher('input[type=email]', cred.BMAXY_ADMIN_EMAIL);
  await preencher('input[type=password]', cred.BMAXY_ADMIN_PASSWORD);

  /* O formulário de login, e não "o primeiro submit da página": os botões
     PT/EN também são type=submit e vêm ANTES no DOM. Clicar no primeiro troca
     o idioma em vez de entrar. */
  await js(`(() => {
    const form = document.querySelector('input[type=email]').closest('form');
    form.querySelector('button[type=submit], button:not([type])').click();
    return true;
  })()`);

  const entrou = await ate("location.pathname.startsWith('/admin')", 20000);
  check(entrou, "login administrativo leva ao painel", await js("location.pathname"));

  /* ======================================================================= */
  console.log("\n2. Criar um livro pelo painel\n");
  /* ======================================================================= */

  await ir("/admin/livros");
  check(await contemAlgum("Livros", "Books"), "a seção Livros abre");

  const seisNaLista = await js(
    `[...document.querySelectorAll('a[href^="/admin/livros/"]')].length >= 6`,
  );
  check(seisNaLista, "os seis livros migrados aparecem na lista");

  await clicarBotao("Novo livro", "New book");
  await sleep(400);

  await preencher('input[name=title]', TITULO);
  await preencher('input[name=slug]', SLUG);
  await clicarBotao("Criar livro", "Create book");

  const criou = await ate(
    `document.body.innerText.includes('Livro criado como rascunho')
     || document.body.innerText.includes('Book created as a draft')`,
    20000,
  );
  check(criou, "o livro é criado como rascunho");

  const { data: criado } = await servico
    .from("books")
    .select("id, status, order_index")
    .eq("slug", SLUG)
    .maybeSingle();
  livroId = criado?.id ?? null;
  check(Boolean(livroId) && criado.status === "draft", "o banco confirma o rascunho", criado?.status);

  /* ======================================================================= */
  console.log("\n3. Preencher o livro pelo formulário\n");
  /* ======================================================================= */

  await ir(`/admin/livros/${livroId}`);
  check(await contem(TITULO), "o editor abre no livro certo");

  await preencher('input[name=printPrice]', "51,00");
  await preencher('input[name=ebookPrice]', "10,20");
  await preencher('textarea[name=synopsisPt]', "Sinopse de teste em portugues.");
  await preencher('textarea[name=synopsisEn]', "Test synopsis in English.");
  await preencher('input[name=coverAltPt]', "Capa de teste");
  await preencher('input[name=coverAltEn]', "Test cover");
  await preencher('input[name=amazon]', "https://www.amazon.com/dp/ZZE2E00000");
  await preencher('input[name=clubeDeAutores]', `https://clubedeautores.com.br/livro/${SLUG}`);

  await clicarBotao("Salvar", "Save");
  const salvou = await ate(
    `document.body.innerText.includes('Livro atualizado')
     || document.body.innerText.includes('Book updated')`,
    20000,
  );
  check(salvou, "o formulário salva");

  const { data: salvo } = await servico
    .from("books")
    .select("print_price_cents, ebook_price_cents")
    .eq("id", livroId)
    .single();
  check(
    salvo.print_price_cents === 5100 && salvo.ebook_price_cents === 1020,
    "os preços foram gravados em CENTAVOS inteiros",
    `${salvo.print_price_cents} / ${salvo.ebook_price_cents}`,
  );

  /* Um link fora da allowlist tem de ser recusado pelo formulário, com
     mensagem — não gravado nem engolido em silêncio. */
  await preencher('input[name=amazon]', "https://amazon.com.invasor.net/dp/X");
  await clicarBotao("Salvar", "Save");
  const recusou = await ate(
    `document.body.innerText.includes('não é da Amazon') || document.body.innerText.includes('not an Amazon')`,
    15000,
  );
  const { data: linkIntacto } = await servico
    .from("book_store_links")
    .select("url")
    .eq("book_id", livroId)
    .eq("store", "amazon")
    .maybeSingle();
  check(recusou, "domínio falso é recusado com mensagem no formulário");
  check(
    linkIntacto?.url === "https://www.amazon.com/dp/ZZE2E00000",
    "e o link antigo permanece intacto",
    linkIntacto?.url,
  );

  /* ======================================================================= */
  console.log("\n4. Rascunho NÃO aparece na vitrine\n");
  /* ======================================================================= */

  await ir("/livros");
  check(!(await contem(TITULO)), "o rascunho não está no catálogo em português");

  await ir(`/livros/${SLUG}`);
  const deu404 = (await texto()).match(/404|não encontrad|not found/i) !== null;
  check(deu404, "a página do rascunho responde 404 para o visitante");

  /* ======================================================================= */
  console.log("\n5. Publicar e ver a vitrine mudar\n");
  /* ======================================================================= */

  await ir(`/admin/livros/${livroId}`);
  await clicarBotao("Publicar", "Publish");
  const publicou = await ate(
    `document.body.innerText.includes('Livro publicado')
     || document.body.innerText.includes('Book published')`,
    20000,
  );
  check(publicou, "o livro é publicado");

  await ir("/livros");
  check(await contem(TITULO), "REVALIDAÇÃO: o livro aparece no catálogo em português");
  check(await contem("R$ 51,00"), "com o preço em reais");

  await ir("/en/books");
  const enTexto = await texto();
  check(await contem(TITULO), "REVALIDAÇÃO: e no catálogo em inglês");

  /* R$ 51,00 ÷ 5,1000 = US$ 10,00 exatos. Escolhido justamente por ser
     redondo: qualquer erro de arredondamento aparece de imediato. */
  check(
    enTexto.includes("Approx. US$ 10.00"),
    "convertido para dólar com o rótulo de aproximação",
    enTexto.match(/Approx\. US\$ [\d.,]+/g)?.slice(0, 3).join(" | ") ?? "nenhum",
  );

  await ir(`/livros/${SLUG}`);
  check(await contem("Sinopse de teste em portugues."), "a página do livro abre em pt");

  await ir(`/en/books/${SLUG}`);
  check(await contem("Test synopsis in English."), "e em en, com a sinopse em inglês");

  /* ======================================================================= */
  console.log("\n6. Mudar a cotação muda TODOS os preços\n");
  /* ======================================================================= */

  await ir("/en/books");
  const antesDaCotacao = (await texto()).match(/Approx\. US\$ [\d.,]+/g) ?? [];

  await ir("/admin/livros");
  await preencher('input[name=rate]', "10,0000");
  await clicarBotao("Salvar cotação", "Save rate");
  const mudouCotacao = await ate(
    `document.body.innerText.includes('Cotação atualizada')
     || document.body.innerText.includes('Exchange rate updated')`,
    20000,
  );
  check(mudouCotacao, "a cotação é salva");

  await ir("/en/books");
  const depoisDaCotacao = await texto();

  /* R$ 51,00 ÷ 10 = US$ 5,10. E, mais importante que o livro de teste: os
     SEIS livros do cliente também mudaram, sem ninguém editar livro nenhum. */
  check(
    depoisDaCotacao.includes("Approx. US$ 5.10"),
    "o livro de teste passa a US$ 5.10",
    depoisDaCotacao.match(/Approx\. US\$ [\d.,]+/g)?.slice(0, 3).join(" | ") ?? "nenhum",
  );

  const depoisLista = depoisDaCotacao.match(/Approx\. US\$ [\d.,]+/g) ?? [];
  const mudaramTodos =
    antesDaCotacao.length > 1 &&
    antesDaCotacao.length === depoisLista.length &&
    antesDaCotacao.every((v, i) => v !== depoisLista[i]);
  check(
    mudaramTodos,
    "TODOS os preços em dólar mudaram, sem editar livro por livro",
    `${antesDaCotacao.length} preços`,
  );

  /* Os preços em REAIS não podem ter mudado: a cotação não os toca. */
  await ir("/livros");
  check(
    (await contem("R$ 73,92")) && (await contem("R$ 51,00")),
    "os preços em reais seguem intactos",
  );

  /* ======================================================================= */
  console.log("\n7. Arquivar tira da vitrine sem apagar\n");
  /* ======================================================================= */

  await ir(`/admin/livros/${livroId}`);
  await clicarBotao("Arquivar", "Archive");

  /* O gatilho e a confirmação têm o MESMO rótulo, e o gatilho vem antes no
     DOM — clicar "Arquivar" duas vezes apenas reabre o diálogo. A confirmação
     é o submit que vive DENTRO do [role=dialog], e é ele que conta. */
  const abriuDialogo = await ate("document.querySelector('[role=dialog]') !== null", 8000);
  check(abriuDialogo, "o diálogo de confirmação abre antes de arquivar");

  await js(
    "(() => {" +
      "const d = document.querySelector('[role=dialog]');" +
      "if (!d) return false;" +
      "const b = d.querySelector('button[type=submit]');" +
      "if (!b) return false;" +
      "b.click();" +
      "return true;" +
      "})()",
  );
  /**
   * A confirmação NÃO é procurada como mensagem de sucesso, e isso é uma
   * conclusão, não uma desistência.
   *
   * `DangerActionForm` só é renderizado enquanto `status !== 'archived'`. Ao
   * arquivar, a revalidação recarrega a página, o componente inteiro deixa de
   * existir — e a mensagem "Livro arquivado" vai junto. Esperar por ela é
   * esperar por um texto que a interface correta nunca chega a mostrar.
   *
   * O que o administrador de fato vê é melhor do que a mensagem: o selo muda
   * para "Arquivado" e o botão vira "Restaurar". É isso que o teste mede.
   */
  const arquivou = await ate(
    `document.body.innerText.toLowerCase().includes('restaurar')
     || document.body.innerText.toLowerCase().includes('restore')`,
    20000,
  );
  check(arquivou, "o painel passa a oferecer restaurar — o livro está arquivado");
  check(await contem("Arquivado", "Archived"), "e o selo de situação acompanha");

  /**
   * Esta asserção é medida com `fetch` do Node, não pelo navegador.
   *
   * O navegador tem cache HTTP próprio, e `/livros` é uma página estática que
   * ele já visitou várias vezes neste teste. Uma falha ali seria ambígua: não
   * dá para saber se o servidor continua servindo o livro ou se o Chrome
   * apenas não pediu de novo. O `fetch` do Node parte sem cache nenhum e
   * responde exatamente à pergunta que importa — o que o SERVIDOR entrega
   * agora.
   */
  /**
   * A REVALIDAÇÃO NÃO É INSTANTÂNEA, e este teste mede convergência.
   *
   * `revalidatePath`/`revalidateTag` MARCAM a página como obsoleta; o Next a
   * regenera em segundo plano e serve a versão antiga enquanto isso. Medido
   * aqui: logo após arquivar, `/livros` ainda trazia o livro; três segundos
   * depois, não.
   *
   * Não é defeito, é o funcionamento de ISR — e é uma característica real da
   * entrega, que vale registrar: por alguns instantes depois de arquivar, um
   * visitante ainda pode ver o livro. O sistema converge sozinho.
   *
   * A espera está AQUI, e não numa afirmação de que "revalidação é imediata",
   * porque a primeira versão deste teste fez duas requisições coladas, viu as
   * duas obsoletas e concluiu que a revalidação não acontecia. A conclusão
   * estava errada; a medição é que era curta demais.
   */
  const ateServidor = async (url, condicao, ms = 15000) => {
    for (let i = 0; i < ms / 500; i++) {
      const html = await (await fetch(url)).text();
      if (condicao(html)) return true;
      await sleep(500);
    }
    return false;
  };

  check(
    await ateServidor(`${BASE}/livros`, (html) => !html.includes(TITULO)),
    "REVALIDAÇÃO: o servidor tira o livro do catálogo em português",
  );
  check(
    await ateServidor(`${BASE}/en/books`, (html) => !html.includes(TITULO)),
    "REVALIDAÇÃO: e do catálogo em inglês",
  );

  /* A página do livro arquivado precisa voltar a ser 404: ela some da vitrine
     e o endereço deixa de existir para quem não é administrador. */
  const detalheSumiu = async () => {
    for (let i = 0; i < 30; i++) {
      if ((await fetch(`${BASE}/livros/${SLUG}`)).status === 404) return true;
      await sleep(500);
    }
    return false;
  };
  check(await detalheSumiu(), "e a página do livro volta a responder 404");

  await ir("/livros");
  check(!(await contem(TITULO)), "e o navegador também deixa de vê-lo");

  const { data: aindaExiste } = await servico
    .from("books")
    .select("status, slug, title")
    .eq("id", livroId)
    .maybeSingle();
  check(
    aindaExiste?.status === "archived" && aindaExiste?.slug === SLUG,
    "mas continua no banco, íntegro — arquivar não apaga",
    aindaExiste?.status,
  );

  const { data: locsSobrevivem } = await servico
    .from("book_localizations")
    .select("locale")
    .eq("book_id", livroId);
  check((locsSobrevivem?.length ?? 0) === 2, "com as sinopses preservadas");
} catch (erro) {
  fail++;
  console.log(`\n  ERRO: ${erro.stack ?? erro.message}`);
} finally {
  console.log("");

  /**
   * A COTAÇÃO VOLTA PELO PAINEL, não por escrita direta no banco.
   *
   * A primeira versão restaurava com o `service_role`, e isso deixava o site
   * quebrado por até uma hora sem ninguém perceber: a escrita direta não
   * dispara revalidação, então o banco dizia 5,1000 enquanto a vitrine em
   * inglês continuava servindo preços calculados a 10,00. Foi encontrado pela
   * verificação visual — `US$ 7.40` onde deveria haver `US$ 14.50`.
   *
   * Além de consertar o teste, isto documenta uma característica real da
   * entrega: alterar dado direto no banco NÃO atualiza a vitrine na hora. Quem
   * revalida é a Server Action. O `revalidate` das rotas é a rede que fecha
   * esse buraco, e ele leva até uma hora.
   */
  try {
    await ir("/admin/livros");
    await preencher('input[name=rate]', "5,1000");
    await clicarBotao("Salvar cotação", "Save rate");
    await ate(
      `document.body.innerText.includes('Cotação atualizada')
       || document.body.innerText.includes('Exchange rate updated')`,
      20000,
    );
  } catch {
    /* Se o navegador já morreu, resta a escrita direta — melhor um site com
       cache velho por uma hora do que a cotação errada no banco para sempre. */
    await servico.from("catalog_settings").update({ brl_per_usd: "5.1000" }).eq("id", true);
  }

  const { data: cot } = await servico.from("catalog_settings").select("brl_per_usd").single();
  check(Number(cot?.brl_per_usd) === 5.1, "cotação restaurada em 5,1000", String(cot?.brl_per_usd));

  /* E a vitrine precisa REFLETIR a restauração, não só o banco. */
  const enRestaurado = await (async () => {
    for (let i = 0; i < 30; i++) {
      const html = await (await fetch(`${BASE}/en/books`)).text();
      if (html.includes("Approx. US$ 14.50")) return true;
      await sleep(500);
    }
    return false;
  })();
  check(enRestaurado, "e a vitrine em inglês volta a mostrar os preços da cotação 5,10");

  if (livroId) {
    await servico.from("books").delete().eq("id", livroId);
    console.log("  livro de teste removido");
  }

  const { data: restam } = await servico
    .from("books")
    .select("slug")
    .order("order_index");
  console.log(`  livros no banco: ${restam?.length} → ${restam?.map((b) => b.slug).join(", ")}`);

  try {
    ws.close();
  } catch {}
  chrome.kill();

  console.log(`\n=== ${pass} ok, ${fail} falha(s) ===`);
  process.exit(fail === 0 ? 0 : 1);
}
