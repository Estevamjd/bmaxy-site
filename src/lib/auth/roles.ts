import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import type { UserRole } from "@/lib/supabase/types";

/**
 * =============================================================================
 *  A QUEM CADA ÁREA PERTENCE, E PARA ONDE CADA ROLE VAI
 * =============================================================================
 *
 *  Módulo puro — sem "server-only", sem Supabase, sem I/O. Existe porque a
 *  resposta para "para onde mando esta pessoa?" estava espalhada por quatro
 *  arquivos, e três deles chutavam `/aluno` como padrão ANTES de saber quem
 *  era. Um administrador logando em `/entrar` sem `?next` caía na área do
 *  aluno; e como as policies de admin leem tudo, ele via até curso em
 *  rascunho — conteúdo que aluno nenhum deveria enxergar.
 *
 *  A regra agora é uma só e mora aqui: o destino só é decidido DEPOIS de a
 *  role real ser lida de `public.user_roles`. Nunca de `user_metadata`, que o
 *  próprio usuário consegue influenciar no cadastro.
 * =========================================================================== */

export type Area = "student" | "admin";

/** Prefixos que pertencem exclusivamente a uma área. */
const AREA_PREFIXES: { prefix: string; area: Area }[] = [
  { prefix: "/aluno", area: "student" },
  { prefix: "/admin", area: "admin" },
];

const HOME_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin",
  student: "/aluno",
};

/** Onde esta role "mora". É o destino padrão e o destino de fallback. */
export function homePathForRole(role: UserRole): string {
  return HOME_BY_ROLE[role];
}

/**
 * A que área um caminho pertence. `null` = rota compartilhada (`/entrar`,
 * `/cadastro`, `/recuperar-senha`, `/acesso-negado`) ou rota pública.
 *
 * Compara por prefixo de SEGMENTO: `/aluno` e `/aluno/curso/x` são da área do
 * aluno, mas uma hipotética `/alunos-publicos` não seria — sem isso, um
 * caminho parecido cairia na área errada.
 */
export function areaForPath(path: string): Area | null {
  const clean = path.split("?")[0].split("#")[0];
  for (const { prefix, area } of AREA_PREFIXES) {
    if (clean === prefix || clean.startsWith(`${prefix}/`)) return area;
  }
  return null;
}

/** A role pode abrir este caminho? Rota compartilhada vale para as duas. */
export function isPathAllowedForRole(path: string, role: UserRole): boolean {
  const area = areaForPath(path);
  if (area === null) return true;
  return area === (role === "admin" ? "admin" : "student");
}

/**
 * O destino depois de autenticar (login ou troca de senha).
 *
 * Três camadas, nesta ordem — e a ordem importa:
 *   1. `safeRedirectTarget` barra redirecionamento aberto (URL absoluta,
 *      "//host", backslash). Isso vem primeiro: não adianta checar a role de
 *      um destino que nem é deste site.
 *   2. Sem `next` válido, vai para a casa da role. NÃO existe padrão "/aluno"
 *      escrito em lugar nenhum — era exatamente esse chute que mandava
 *      administrador para a área errada.
 *   3. Com `next` válido, ele só é respeitado se for compatível com a role.
 *      Um aluno pedindo `next=/admin` vai para `/aluno`; um admin com um
 *      `next=/aluno/curso/x` guardado de um link antigo vai para `/admin`.
 *      Sem isso, o `?next` seria uma forma de contornar a separação.
 */
export function resolvePostAuthDestination(
  next: string | null | undefined,
  role: UserRole,
): string {
  const home = homePathForRole(role);

  // Fallback vazio de propósito: quero distinguir "não veio next" de "veio um
  // next que não presta", e nos dois casos cair na casa da role.
  const safe = safeRedirectTarget(next, "");
  if (!safe) return home;

  return isPathAllowedForRole(safe, role) ? safe : home;
}
