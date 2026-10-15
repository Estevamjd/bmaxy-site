import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";
import { AUTH_COOKIE_OPTIONS } from "./cookies";
import { getSupabaseEnv } from "./env";

/**
 * Cliente para Server Components, Server Actions e Route Handlers.
 *
 * Usa `getAll`/`setAll` (API atual do @supabase/ssr) em vez dos métodos
 * antigos `get`/`set`/`remove` por cookie, que estão depreciados.
 *
 * O `try/catch` em `setAll` existe porque Server Components RENDERIZANDO
 * (não Server Actions, não Route Handlers) não podem escrever cookies — o
 * Next lança nesse caso. Isso é esperado: a sessão é de fato renovada pelo
 * middleware (src/middleware.ts) a cada requisição; aqui só ignoramos o
 * erro quando a escrita não é permitida no contexto atual.
 */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    // Os MESMOS atributos usados no middleware — ver o porquê em ./cookies.ts.
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Chamado de um Server Component em renderização — sem problema,
          // o middleware já cuida de renovar e persistir a sessão.
        }
      },
    },
  });
}
