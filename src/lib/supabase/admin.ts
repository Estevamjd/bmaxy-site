import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getSupabaseEnv } from "./env";
import { getSupabaseSecretKey, isSupabaseAdminConfigured } from "./secret";

/**
 * Cliente com a chave secreta (service role) — ignora RLS por completo.
 *
 * REGRAS DESTE ARQUIVO:
 *   - Nunca importar de um Client Component ("use client").
 *   - Nunca importar de um módulo que também é importado por um Client
 *     Component (o import "server-only" no topo faz o build FALHAR se isso
 *     acontecer, em vez de vazar a chave silenciosamente).
 *   - Só chamar a partir de Server Actions ou Route Handlers que já
 *     validaram `requireAdmin()` (src/lib/auth/session.ts) — este cliente
 *     não sabe quem está pedindo, então quem chama é responsável por checar
 *     a permissão ANTES.
 *   - Usado hoje só para supabase.auth.admin.* (criar/gerenciar contas de
 *     aluno). Para ler/escrever nas tabelas de negócio, prefira o cliente
 *     normal (server.ts) autenticado como admin — ele passa pelas policies
 *     "*_admin_all" em vez de contornar RLS, o que é mais seguro e mais
 *     fácil de auditar.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secretKey = getSupabaseSecretKey();

  if (!isSupabaseAdminConfigured() || !url || !secretKey) {
    throw new Error(
      "Supabase admin não configurado: defina SUPABASE_SECRET_KEY além das variáveis públicas.",
    );
  }

  return createSupabaseClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
