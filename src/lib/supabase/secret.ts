import "server-only";

/**
 * Chave secreta do Supabase: lida só no servidor.
 * O `server-only` quebra o build se este módulo for importado por um Client Component.
 */
export function getSupabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY;
}

/** true quando a chave secreta existe (operações administrativas). */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SECRET_KEY,
  );
}
