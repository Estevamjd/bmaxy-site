"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { getSupabaseEnv } from "./env";

/**
 * Cliente para Client Components. Usa só a URL e a chave publicável — as
 * duas são seguras no navegador porque toda tabela sensível tem RLS.
 *
 * Lança se chamado sem as variáveis configuradas: componentes que usam este
 * cliente já checam `isSupabaseConfigured()` antes (ver
 * src/lib/supabase/env.ts) e mostram a mensagem de "em configuração" em vez
 * de chegar aqui.
 */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return createBrowserClient<Database>(url, publishableKey);
}
