import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

/**
 * =============================================================================
 *  "PLATAFORMA EM CONFIGURAÇÃO" — o modo que o CI passou a esconder
 * =============================================================================
 *
 *  Contexto de por que este arquivo existe.
 *
 *  O E2E do CI falhava em quatro asserções: `/entrar` e `/recuperar-senha`, em
 *  pt e en, renderizavam o aviso de "plataforma em configuração" em vez do
 *  formulário, porque o runner não tinha as variáveis públicas do Supabase.
 *  A correção foi dar ao step do E2E variáveis FICTÍCIAS.
 *
 *  Só que isso cria um risco novo e silencioso: a partir de agora, **nenhum
 *  teste automatizado passa mais pelo caminho não configurado**. Se alguém
 *  afrouxar `isSupabaseConfigured()` — por exemplo, devolvendo `true` quando a
 *  chave é string vazia —, a aplicação passaria a tentar falar com um Supabase
 *  que não existe, e o CI continuaria verde.
 *
 *  Este arquivo é o contrapeso. Ele exercita a decisão pura, sem navegador e
 *  sem servidor, e é o que impede a correção do CI de virar um ponto cego.
 *
 *  O módulo lê `process.env` em cada chamada, não na importação — daí a
 *  reimportação com cache-busting entre os casos.
 */

const ORIGINAL = { ...process.env };

const carregar = async () => {
  const url = new URL("../src/lib/supabase/env.ts", import.meta.url);
  url.searchParams.set("t", String(Math.round(performance.now() * 1000)));
  return import(url.href);
};

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

/* ------------------------- o caminho não configurado ---------------------- */

test("sem NENHUMA variável, a plataforma se declara não configurada", async () => {
  const { isSupabaseConfigured } = await carregar();

  /* É este `false` que faz `/entrar` renderizar o aviso em vez do formulário,
     e é ele que permite `npm run build` rodar no CI sem secret nenhum. */
  assert.equal(isSupabaseConfigured(), false);
});

test("só a URL não basta — falta a chave publicável", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
  const { isSupabaseConfigured } = await carregar();
  assert.equal(isSupabaseConfigured(), false);
});

test("só a chave não basta — falta a URL", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qualquer";
  const { isSupabaseConfigured } = await carregar();
  assert.equal(isSupabaseConfigured(), false);
});

test("string vazia NÃO conta como configurado", async () => {
  /* O modo mais fácil de afrouxar isto sem perceber é trocar a checagem de
     presença por uma checagem de "a variável existe". No CI e na Vercel, uma
     variável definida e vazia é comum — e ela levaria a aplicação a tentar
     falar com um Supabase inexistente em vez de mostrar o aviso. */
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
  const { isSupabaseConfigured } = await carregar();
  assert.equal(isSupabaseConfigured(), false);
});

/* --------------------------- o caminho configurado ------------------------ */

test("com as duas variáveis públicas, a plataforma se declara configurada", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://e2e-nao-existe.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test-key";

  const { isSupabaseConfigured } = await carregar();

  /* Exatamente o par que o step do E2E fornece. Se este teste quebrar depois
     de alguém mexer no workflow, é sinal de que os dois saíram de sincronia. */
  assert.equal(isSupabaseConfigured(), true);
});

test("a chave SECRETA não participa da decisão", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qualquer";

  const { isSupabaseConfigured, getSupabaseEnv } = await carregar();

  /* `isSupabaseConfigured()` responde sobre a superfície PÚBLICA. Se ela
     passasse a exigir a secret, o CI voltaria a precisar de um segredo só para
     renderizar uma tela de login — e o build sem configuração deixaria de
     existir. Quem cuida da secret é `isSupabaseAdminConfigured()`, noutro
     módulo, que é `server-only`. */
  assert.equal(isSupabaseConfigured(), true);
  assert.equal("secretKey" in getSupabaseEnv(), false);
});

/* ------------------------------- siteUrl ---------------------------------- */

test("sem NEXT_PUBLIC_SITE_URL, o padrão é localhost", async () => {
  const { getSupabaseEnv } = await carregar();
  assert.equal(getSupabaseEnv().siteUrl, "http://localhost:3000");
});

test("o siteUrl declarado é respeitado", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://bmaxy.com";
  const { getSupabaseEnv } = await carregar();

  /* Não é só um link: é ele que decide se o cookie de sessão é `Secure` e se o
     Turnstile é obrigatório. Um valor errado aqui desliga os dois em silêncio. */
  assert.equal(getSupabaseEnv().siteUrl, "https://bmaxy.com");
});
