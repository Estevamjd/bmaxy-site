/**
 * Uma única fonte de verdade pra "o Supabase está configurado?". Nenhum
 * outro módulo deve ler process.env.SUPABASE_* diretamente — assim o
 * comportamento de "plataforma em configuração" (ver isSupabaseConfigured)
 * fica consistente em toda a app, e o build nunca quebra por variável
 * ausente.
 *
 * Aqui só entra o que é seguro no navegador. Este arquivo é alcançável a
 * partir de um Client Component (`client.ts` o importa), então a chave secreta
 * NÃO mora aqui: ela fica em `secret.ts`, que é `server-only`.
 */

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  };
}

/** true só quando as duas variáveis públicas mínimas existem. */
export function isSupabaseConfigured(): boolean {
  const { url, publishableKey } = getSupabaseEnv();
  return Boolean(url && publishableKey);
}
