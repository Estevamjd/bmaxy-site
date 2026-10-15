import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

/**
 * A decisão do Turnstile: quando passa, quando reprova, e — o que mais importa
 * — quando NÃO dá para saber.
 *
 * O módulo é `server-only` e lê `process.env` no momento da chamada, não na
 * importação. Por isso os testes mexem no ambiente e reimportam com um sufixo
 * de cache-busting; sem isso o segundo teste herdaria a configuração do
 * primeiro e passaria por engano.
 */

const ORIGINAL = { ...process.env };

/** `server-only` só existe no bundler do Next; no runner, é um módulo vazio. */
const carregar = async () => {
  const url = new URL("../src/lib/security/turnstile.ts", import.meta.url);
  url.searchParams.set("t", String(Math.round(performance.now() * 1000)));
  return import(url.href);
};

const comFetch = (resposta: unknown, ok = true) => {
  globalThis.fetch = (async () =>
    ({ ok, json: async () => resposta }) as unknown as Response) as typeof fetch;
};

beforeEach(() => {
  process.env.TURNSTILE_SECRET_KEY = "segredo-de-teste";
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-de-teste";
  process.env.NEXT_PUBLIC_SITE_URL = "https://bmaxy.com";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

/* ------------------------------- aprovação -------------------------------- */

test("token válido passa", async () => {
  comFetch({ success: true });
  const { verificarTurnstile } = await carregar();
  assert.deepEqual(await verificarTurnstile("token-bom"), { status: "ok" });
});

/* ------------------------------- reprovação ------------------------------- */

test("token ausente é reprovado sem ir à rede", async () => {
  let bateuNaRede = false;
  globalThis.fetch = (async () => {
    bateuNaRede = true;
    return { ok: true, json: async () => ({ success: true }) } as unknown as Response;
  }) as typeof fetch;

  const { verificarTurnstile } = await carregar();
  const r = await verificarTurnstile(null);

  assert.equal(r.status, "reprovado");
  assert.equal(bateuNaRede, false, "não faz sentido perguntar à Cloudflare sobre um token que não existe");
});

test("token acima de 2048 caracteres é cortado antes da rede", async () => {
  let bateuNaRede = false;
  globalThis.fetch = (async () => {
    bateuNaRede = true;
    return { ok: true, json: async () => ({ success: true }) } as unknown as Response;
  }) as typeof fetch;

  const { verificarTurnstile } = await carregar();
  const r = await verificarTurnstile("x".repeat(2049));

  assert.equal(r.status, "reprovado");
  assert.equal(bateuNaRede, false, "a API recusa acima de 2048; ir à rede seria desperdício");
});

test("token já usado é reprovado com motivo próprio", async () => {
  comFetch({ success: false, "error-codes": ["timeout-or-duplicate"] });
  const { verificarTurnstile, mensagemTurnstile } = await carregar();
  const r = await verificarTurnstile("token-repetido");

  assert.deepEqual(r, { status: "reprovado", motivo: "timeout-or-duplicate" });
  /* Este caso quase sempre é reenvio de formulário depois de um erro, não
     robô. A mensagem precisa dizer "expirou", não "você é um robô". */
  assert.match(mensagemTurnstile(r) ?? "", /expirou/i);
});

/* ---------------------------- indisponibilidade --------------------------- */

test("erro de rede vira 'indisponível', nunca 'reprovado'", async () => {
  globalThis.fetch = (async () => {
    throw new Error("ECONNRESET");
  }) as typeof fetch;

  const { verificarTurnstile } = await carregar();
  const r = await verificarTurnstile("token-bom");

  /* A diferença importa: acusar de robô alguém que só pegou a Cloudflare fora
     do ar é mentira, e a mensagem na tela precisa ser outra. */
  assert.equal(r.status, "indisponivel");
});

test("internal-error da Cloudflare é indisponibilidade, não reprovação", async () => {
  comFetch({ success: false, "error-codes": ["internal-error"] });
  const { verificarTurnstile } = await carregar();
  assert.equal((await verificarTurnstile("token-bom")).status, "indisponivel");
});

test("HTTP não-2xx vira indisponibilidade", async () => {
  comFetch({}, false);
  const { verificarTurnstile } = await carregar();
  assert.equal((await verificarTurnstile("token-bom")).status, "indisponivel");
});

/* ------------------------- configuração do servidor ----------------------- */

test("segredo inválido é erro NOSSO, não culpa de quem está na tela", async () => {
  comFetch({ success: false, "error-codes": ["invalid-input-secret"] });
  const { verificarTurnstile } = await carregar();

  const r = await verificarTurnstile("token-bom");
  assert.equal(r.status, "mal_configurado");
});

test("sem chaves em DESENVOLVIMENTO, o desafio fica desligado", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

  const { verificarTurnstile } = await carregar();
  assert.deepEqual(await verificarTurnstile(null), { status: "ok" });
});

test("sem chaves em PRODUÇÃO, a ação falha — fechada, não aberta", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  process.env.NEXT_PUBLIC_SITE_URL = "https://bmaxy.com";

  const { verificarTurnstile, mensagemTurnstile } = await carregar();
  const r = await verificarTurnstile("qualquer-coisa");

  /* É O TESTE MAIS IMPORTANTE DO ARQUIVO. Se esta asserção inverter, "esqueci
     de configurar a chave em produção" vira "a proteção nunca existiu" — e
     ninguém percebe, porque tudo continua funcionando. */
  assert.equal(r.status, "mal_configurado");
  assert.ok(mensagemTurnstile(r), "precisa haver mensagem para a tela");
});

test("o https de NEXT_PUBLIC_SITE_URL é o que decide, não NODE_ENV", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

  const { verificarTurnstile } = await carregar();

  /* `npm run build && npm start` roda como produção em localhost. Se o
     critério fosse NODE_ENV, ninguém conseguiria testar o build de produção
     localmente sem uma conta na Cloudflare. */
  assert.deepEqual(await verificarTurnstile(null), { status: "ok" });
});

/* ------------------------------- mensagens -------------------------------- */

test("nenhuma mensagem vaza o código interno da Cloudflare", async () => {
  const { mensagemTurnstile } = await carregar();
  const internos = [
    "invalid-input-secret",
    "missing-input-secret",
    "bad-request",
    "internal-error",
    "timeout-or-duplicate",
  ];

  for (const motivo of internos) {
    for (const resultado of [
      { status: "reprovado" as const, motivo },
      { status: "indisponivel" as const, motivo },
    ]) {
      const texto = mensagemTurnstile(resultado) ?? "";
      assert.ok(texto.length > 0, `${resultado.status}/${motivo} ficou sem mensagem`);
      assert.equal(
        texto.includes(motivo),
        false,
        `o código "${motivo}" vazou para a tela: ${texto}`,
      );
    }
  }
});

test("aprovado não gera mensagem", async () => {
  const { mensagemTurnstile } = await carregar();
  assert.equal(mensagemTurnstile({ status: "ok" }), null);
});
