import "server-only";
import { redirect } from "next/navigation";
import { homePathForRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { UserRole } from "@/lib/supabase/types";

export type AuthContext = {
  userId: string;
  email: string | null;
  fullName: string;
  locale: "pt" | "en";
  role: UserRole | null;
  mustChangePassword: boolean;
};

/**
 * Busca o usuário autenticado a partir do servidor. Usa
 * `supabase.auth.getUser()` — NUNCA `getSession()` — porque getUser()
 * revalida o token contra o servidor do Supabase Auth a cada chamada, em
 * vez de confiar no conteúdo do cookie sem checar. getSession() é rápido
 * mas não é uma verificação de autenticidade por si só.
 *
 * Retorna `null` tanto para "sem sessão" quanto para "Supabase não
 * configurado" — as páginas protegidas tratam os dois casos de forma
 * parecida (ver isSupabaseConfigured() quando precisarem distinguir).
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, locale, must_change_password")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profileRow?.full_name ?? "",
    locale: profileRow?.locale ?? "pt",
    role: roleRow?.role ?? null,
    mustChangePassword: profileRow?.must_change_password ?? false,
  };
}

/**
 * Base de qualquer rota protegida: exige sessão válida E uma role
 * reconhecida (student ou admin). Uma conta autenticada sem role — não
 * deveria existir, dado o trigger em auth.users, mas é tratada com
 * segurança mesmo assim — cai em /acesso-negado em vez de qualquer área.
 */
/**
 * O retorno promete `role` NÃO-nulo: quem chega ao `return` já passou pelos
 * dois redirects acima. Sem essa promessa no tipo, todo chamador precisaria
 * re-checar `auth.role` — e o TypeScript não deduz sozinho que `redirect()`
 * encerra o fluxo dentro de um objeto já desestruturado.
 */
export type AuthenticatedContext = AuthContext & { role: UserRole };

export async function requireUser(nextPath: string): Promise<AuthenticatedContext> {
  const auth = await getAuthContext();

  if (!auth) {
    redirect(`/entrar?next=${encodeURIComponent(nextPath)}`);
  }
  if (!auth.role) {
    redirect("/acesso-negado");
  }

  /* A troca de senha temporária era checada SÓ em loginAction. Quem já tinha
   * sessão simplesmente navegava para /aluno ou /admin e nunca mais era
   * perguntado — a conta criada pelo painel seguia com a senha que o
   * administrador conhece. Aqui a checagem passa a valer em toda rota
   * protegida, não só no momento do login.
   *
   * Sem risco de laço: /redefinir-senha não passa por requireUser (lê o
   * usuário direto de getUser), e resetPasswordAction zera a flag antes de
   * mandar a pessoa para a área dela. */
  if (auth.mustChangePassword) {
    redirect("/redefinir-senha");
  }

  return { ...auth, role: auth.role };
}

/** Exige role admin. Conta válida mas sem ser admin volta pra própria área. */
export async function requireAdmin(nextPath: string): Promise<AuthenticatedContext> {
  const auth = await requireUser(nextPath);

  if (auth.role !== "admin") {
    redirect(homePathForRole(auth.role));
  }

  return auth;
}

/**
 * Exige role student. O ESPELHO de requireAdmin, e a peça que faltava.
 *
 * Antes, a área do aluno usava só requireUser(), que aceita qualquer role
 * reconhecida — então um administrador entrava em /aluno e navegava por lá.
 * Isso não é cosmético: as policies de admin (`is_admin() OR ...` em courses,
 * course_modules, lessons) liberam leitura completa, então dentro da área do
 * aluno o admin enxergava inclusive CURSO EM RASCUNHO, que aluno nenhum vê.
 * A tela do aluno confiava na RLS para filtrar, e para o admin a RLS não
 * filtra nada.
 *
 * Administrador não é "um aluno com mais poderes": é outra área. Quem cai
 * aqui sendo admin vai para /admin.
 */
export async function requireStudent(nextPath: string): Promise<AuthenticatedContext> {
  const auth = await requireUser(nextPath);

  if (auth.role !== "student") {
    redirect(homePathForRole(auth.role));
  }

  return auth;
}
