import { NextResponse, type NextRequest } from "next/server";
import { resolvePostAuthDestination } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Recebe o link de e-mail do Supabase (recuperação de senha, e no futuro
 * qualquer outro fluxo PKCE), troca o `code` por uma sessão de verdade e
 * redireciona pro destino validado. Sem `code` ou com erro na troca, volta
 * pro login com um aviso — nunca deixa a pessoa "meio autenticada".
 *
 * O DESTINO É RESOLVIDO DEPOIS DA TROCA, e não antes.
 *
 * Esta rota ficou de fora da primeira rodada de correção e foi apontada pela
 * revisão de segurança. Ela fazia:
 *
 *     const next = safeRedirectTarget(searchParams.get("next"), "/aluno");
 *
 * — o mesmo "/aluno" chutado que já tinha sido removido de /entrar e de
 * /redefinir-senha, e pelo mesmo motivo: naquele ponto ainda não existe sessão
 * (o exchangeCodeForSession só acontece depois), então não há role nenhuma
 * para consultar. Um administrador clicando no link de recuperação de senha
 * era mandado para a área do aluno.
 *
 * Agora a role é lida de public.user_roles com a sessão recém-criada, e
 * `resolvePostAuthDestination` decide — as mesmas três camadas do login: barra
 * redirecionamento aberto, cai na casa da role quando não há `next`
 * aproveitável, e recusa `next` de outra área.
 *
 * A concatenação `${origin}${destino}` continua sendo defesa em profundidade:
 * o destino já vem normalizado como caminho interno, então ela é redundante de
 * propósito.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/entrar`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // O mesmo cliente que acabou de criar a sessão — não um novo, para não
      // depender de o cookie já estar visível numa segunda leitura.
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!roleRow?.role) {
        // Conta sem role não deveria existir (o trigger cria 'student'), mas
        // adivinhar uma área aqui seria pior do que parar.
        return NextResponse.redirect(`${origin}/acesso-negado`);
      }

      const destino = resolvePostAuthDestination(searchParams.get("next"), roleRow.role);
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`);
}
