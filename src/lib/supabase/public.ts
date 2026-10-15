import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getSupabaseEnv } from "./env";

/**
 * =============================================================================
 *  CLIENTE ANÔNIMO — leitura pública, sem cookie, sem sessão
 * =============================================================================
 *
 *  Existe por causa de UMA linha de `server.ts`: `await cookies()`.
 *
 *  Ler cookies marca a rota como dinâmica no App Router. O catálogo público
 *  (`/livros`, `/livros/[slug]`, `/en/books`, `/en/books/[slug]`) é a mesma
 *  página para todo mundo — nenhum visitante vê um livro diferente do outro —
 *  e deve ser gerada uma vez e servida do cache até um administrador mudar
 *  alguma coisa. Usar o cliente com cookies ali trocaria uma página estática
 *  por uma consulta ao banco em toda visita, sem ganho nenhum.
 *
 *  Também é o cliente HONESTO para esse caso: a vitrine não deveria enxergar
 *  nada além do que um desconhecido enxerga. Como este cliente não carrega
 *  sessão, o Postgres o atende como `anon`, e a policy `books_select_anon`
 *  (`status = 'published'`) é o teto — não uma convenção que o código
 *  precisa lembrar de respeitar.
 *
 *  Consequência que vale registrar: um administrador logado navegando em
 *  `/livros` vê o catálogo PÚBLICO, sem os rascunhos. É o correto — a
 *  pré-visualização de rascunho é uma rota do painel, não a vitrine.
 *
 *  `persistSession: false`: sem isso a biblioteca tenta guardar sessão num
 *  storage que não existe no servidor, e um processo Node compartilhado entre
 *  requisições é o pior lugar possível para um objeto de sessão global.
 * =========================================================================== */
export function createPublicClient() {
  const { url, publishableKey } = getSupabaseEnv();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return createSupabaseClient<Database>(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
