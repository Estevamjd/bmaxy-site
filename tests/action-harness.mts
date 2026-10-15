import * as nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Bancada para testar Server Actions de verdade — a action importada é a de
 * produção, sem cópia e sem reescrita.
 *
 * Por que precisa de bancada: `src/lib/actions/*.ts` importa `next/navigation`,
 * `next/cache` e os clientes do Supabase. Nenhum deles carrega fora de uma
 * requisição do Next, então sem trocar esses quatro módulos por dublês o
 * arquivo nem chega a ser lido pelo Node.
 *
 * A troca usa `module.registerHooks()` — hooks SÍNCRONOS, na própria thread,
 * sem flag experimental e sem dependência nova. O alias "@/" é resolvido aqui
 * também (mesma regra do tests/alias-hook.mjs), porque estes hooks têm
 * precedência e não repassam adiante o que interceptam.
 *
 * O que NÃO é dublê, de propósito: validação (zod), `resolvePostAuthDestination`
 * e o resto de `src/lib`. Se um teste daqui passar com a regra de negócio
 * quebrada, o teste é que está errado.
 */

/** Node ganhou registerHooks em 22.15/23.5. Sem ele, os testes se declaram pulados em vez de derrubar a suíte inteira. */
export const canStubModules = typeof nodeModule.registerHooks === "function";

export const skipWithoutStubs = canStubModules
  ? false
  : "requer module.registerHooks (Node >= 22.15)";

const SRC = path.resolve(fileURLToPath(import.meta.url), "../../src");

const STUB_PREFIX = "stub:";

/**
 * Os dublês são texto JS puro: eles são carregados por baixo do TypeScript,
 * então não podem depender de nada que precise ser compilado.
 *
 * `redirect()` LANÇA, igual ao do Next — é assim que a action encerra o fluxo.
 * Um dublê que só registrasse a chamada e retornasse deixaria a action seguir
 * executando linhas que, em produção, nunca rodam.
 */
const STUBS = new Map([
  [
    "next/navigation",
    `export function redirect(url) {
       const error = new Error("NEXT_REDIRECT");
       error.digest = "NEXT_REDIRECT;" + url;
       throw error;
     }`,
  ],
  ["next/cache", "export function revalidatePath() {}"],
  [
    "@/lib/supabase/server",
    `export async function createClient() {
       if (!globalThis.__bmaxySupabase) throw new Error("teste não definiu o cliente autenticado");
       return globalThis.__bmaxySupabase;
     }`,
  ],
  [
    "@/lib/supabase/admin",
    `export function createAdminClient() {
       if (!globalThis.__bmaxyAdminFactory) throw new Error("teste não definiu o cliente de service role");
       return globalThis.__bmaxyAdminFactory();
     }`,
  ],
  [
    "@/lib/auth/session",
    `export async function getAuthContext() {
       return globalThis.__bmaxyAuthContext ?? null;
     }
     export async function requireAdmin() {
       globalThis.__bmaxyRequireAdminCalls = (globalThis.__bmaxyRequireAdminCalls ?? 0) + 1;
       globalThis.__bmaxySeq = (globalThis.__bmaxySeq ?? 0) + 1;
       // Só a PRIMEIRA chamada interessa: é a posição dela na sequência que
       // diz se a guarda veio antes de qualquer acesso a dado.
       globalThis.__bmaxyRequireAdminSeq ??= globalThis.__bmaxySeq;
       return { userId: "admin-de-teste", role: "admin", email: null, fullName: "", locale: globalThis.__bmaxyAdminLocale ?? "pt", mustChangePassword: false };
     }
     export async function requireStudent() {
       globalThis.__bmaxyRequireStudentCalls = (globalThis.__bmaxyRequireStudentCalls ?? 0) + 1;
       globalThis.__bmaxySeq = (globalThis.__bmaxySeq ?? 0) + 1;
       return { userId: "student-de-teste", role: "student", email: null, fullName: "", locale: globalThis.__bmaxyStudentLocale ?? "pt", mustChangePassword: false };
     }`,
  ],
  [
    "@/lib/i18n/locale",
    `export async function getPlatformLocale() { return globalThis.__bmaxyLocale ?? "pt"; }
     export async function getLocaleCookie() { return globalThis.__bmaxyLocale ?? "pt"; }
     export async function setLocaleCookie(locale) { globalThis.__bmaxyLocale = locale; }
     export function localeHomePath(locale) { return locale === "en" ? "/en" : "/"; }`,
  ],
]);

if (canStubModules) {
  // Sem as variáveis públicas, isSupabaseConfigured() é false e toda action de
  // auth devolve "plataforma em configuração" antes de tocar no que se testa.
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://supabase.invalido";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= "chave-de-teste";
  process.env.NEXT_PUBLIC_SITE_URL ||= "http://localhost:3000";

  nodeModule.registerHooks({
    resolve(specifier: string, context: unknown, nextResolve: CallableFunction) {
      if (STUBS.has(specifier)) {
        return { url: STUB_PREFIX + specifier, format: "module", shortCircuit: true };
      }
      if (specifier.startsWith("@/")) {
        const base = path.join(SRC, specifier.slice(2));
        return { url: pathToFileURL(base + ".ts").href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
    load(url: string, context: unknown, nextLoad: CallableFunction) {
      if (url.startsWith(STUB_PREFIX)) {
        return {
          format: "module",
          source: STUBS.get(url.slice(STUB_PREFIX.length)),
          shortCircuit: true,
        };
      }
      return nextLoad(url, context);
    },
  });
}

/* --------------------------------------------------------------------------
   Cliente Supabase de mentira
   -------------------------------------------------------------------------- */

export type FakeOp = {
  kind: "select" | "insert" | "update" | "delete" | "rpc";
  table?: string;
  fn?: string;
  args?: unknown;
  payload?: unknown;
  filters: Record<string, unknown>;
  columns?: string;
  single: boolean;
  /** Posição na sequência global — usada para provar ORDEM entre guarda e dado. */
  seq?: number;
};

export type FakeResult = { data?: unknown; error?: unknown };

/** Decide a resposta de cada chamada. `index` é a ordem da chamada no teste. */
export type Responder = (op: FakeOp, index: number) => FakeResult;

export type FakeClient = {
  calls: FakeOp[];
  from: (table: string) => Record<string, CallableFunction>;
  rpc: (fn: string, args?: unknown) => PromiseLike<FakeResult>;
  auth: Record<string, unknown>;
};

/**
 * Reproduz só o encadeamento que as actions usam
 * (`.from().update().eq().select().maybeSingle()`, `.insert()`, `.rpc()`) e
 * grava cada chamada para o teste conferir o que foi pedido ao banco.
 */
export function createFakeClient(
  responder: Responder,
  auth: Record<string, unknown> = {},
): FakeClient {
  const calls: FakeOp[] = [];

  function settle(op: FakeOp) {
    const index = calls.length;
    // Posição global da operação, compartilhada com o dublê de requireAdmin.
    // É o que permite provar ORDEM ("a guarda veio antes de tocar em dado")
    // em vez de só contar chamadas.
    const g = globalThis as { __bmaxySeq?: number };
    g.__bmaxySeq = (g.__bmaxySeq ?? 0) + 1;
    op.seq = g.__bmaxySeq;
    calls.push(op);
    const result = responder(op, index);
    return { data: result.data ?? null, error: result.error ?? null };
  }

  function chainFor(op: FakeOp) {
    const chain: Record<string, CallableFunction> = {
      insert(payload: unknown) {
        op.kind = "insert";
        op.payload = payload;
        return chain;
      },
      update(payload: unknown) {
        op.kind = "update";
        op.payload = payload;
        return chain;
      },
      delete() {
        op.kind = "delete";
        return chain;
      },
      upsert(payload: unknown) {
        op.kind = "insert";
        op.payload = payload;
        return chain;
      },
      select(columns?: string) {
        op.columns = columns;
        return chain;
      },
      eq(column: string, value: unknown) {
        op.filters[column] = value;
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      maybeSingle() {
        op.single = true;
        return chain;
      },
      // Awaitable: é aqui que a "consulta" acontece, como no supabase-js.
      then(onFulfilled: CallableFunction, onRejected: CallableFunction) {
        return Promise.resolve(settle(op)).then(
          onFulfilled as never,
          onRejected as never,
        );
      },
    };
    return chain;
  }

  return {
    calls,
    from(table: string) {
      return chainFor({ kind: "select", table, filters: {}, single: false });
    },
    rpc(fn: string, args?: unknown) {
      const op: FakeOp = { kind: "rpc", fn, args, filters: {}, single: false };
      return {
        then(onFulfilled: CallableFunction, onRejected: CallableFunction) {
          return Promise.resolve(settle(op)).then(
            onFulfilled as never,
            onRejected as never,
          );
        },
      } as PromiseLike<FakeResult>;
    },
    auth,
  };
}

/** Instala o cliente que o dublê de `@/lib/supabase/server` vai devolver. */
export function stubSupabase(client: unknown): void {
  Object.assign(globalThis, { __bmaxySupabase: client });
}

/**
 * Instala a fábrica do cliente de service role. É uma FÁBRICA, e não o cliente
 * pronto, porque `createAdminClient()` lança quando falta SUPABASE_SECRET_KEY —
 * e esse caminho precisa ser testável.
 */
export function stubAdminClient(factory: () => unknown): void {
  Object.assign(globalThis, { __bmaxyAdminFactory: factory });
}

/** Limpa o estado global entre testes, para um teste não herdar o dublê do outro. */
export function resetHarness(): void {
  Object.assign(globalThis, {
    __bmaxySupabase: undefined,
    __bmaxyAdminFactory: undefined,
    __bmaxyRequireAdminCalls: 0,
    __bmaxyRequireStudentCalls: 0,
    __bmaxyStudentLocale: "pt",
    __bmaxyAdminLocale: "pt",
    __bmaxyAuthContext: undefined,
    __bmaxyLocale: "pt",
    __bmaxySeq: 0,
    __bmaxyRequireAdminSeq: undefined,
  });
}

/** Quantas vezes requireAdmin() foi chamado desde o último reset. */
export function requireAdminCalls(): number {
  return (globalThis as { __bmaxyRequireAdminCalls?: number }).__bmaxyRequireAdminCalls ?? 0;
}

/**
 * Avança e devolve a sequência global. Existe para que dublês definidos FORA
 * do harness — `auth.admin.createUser`, por exemplo — entrem na mesma linha do
 * tempo das operações de tabela. Sem isso, uma asserção de ordem enxergaria só
 * parte do que a action faz.
 */
export function nextSeq(): number {
  const g = globalThis as { __bmaxySeq?: number };
  g.__bmaxySeq = (g.__bmaxySeq ?? 0) + 1;
  return g.__bmaxySeq;
}

/**
 * Posição de requireAdmin() na sequência global de operações, ou null se nunca
 * foi chamado.
 *
 * Existe porque contar chamadas NÃO prova ordem: uma action que chamasse
 * requireAdmin() depois de já ter criado o usuário passaria por
 * `requireAdminCalls() === 1` exatamente igual. O que interessa é que a guarda
 * venha ANTES de qualquer toque em dado.
 */
export function requireAdminSeq(): number | null {
  return (globalThis as { __bmaxyRequireAdminSeq?: number }).__bmaxyRequireAdminSeq ?? null;
}

/**
 * Roda a action esperando que ela termine em `redirect()`, e devolve o destino.
 * Falha o teste se a action retornar normalmente — "voltou sem redirecionar"
 * é justamente o defeito que os testes de sucesso precisam pegar.
 */
export async function captureRedirect(run: () => Promise<unknown>): Promise<string> {
  let returned: unknown;
  let redirected: string | null = null;

  try {
    returned = await run();
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;")) {
      redirected = digest.slice("NEXT_REDIRECT;".length);
    } else {
      throw error;
    }
  }

  if (redirected === null) {
    throw new Error(
      `esperava um redirect, mas a action retornou ${JSON.stringify(returned)}`,
    );
  }
  return redirected;
}

/** FormData a partir de um objeto — o formato que as actions recebem. */
export function formDataOf(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}
