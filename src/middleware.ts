import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";
import { isPlatformLocale, PLATFORM_LOCALE_COOKIE } from "@/content/platform";

const PROTECTED_PREFIXES = ["/aluno", "/admin"];

/**
 * HSTS — o único cabeçalho de segurança que NÃO está em next.config.ts.
 *
 * Ele depende do protocolo da requisição, e mandá-lo por HTTP é pior do que
 * não mandar: o navegador ignora, e num ambiente local ele grava a regra para
 * `localhost` e passa a forçar HTTPS em TODO projeto que rode nessa porta —
 * por meses, sem jeito óbvio de desfazer fora de `chrome://net-internals`.
 *
 * Atrás do proxy da Vercel a requisição chega como HTTP; quem diz a verdade é
 * `x-forwarded-proto`.
 *
 * `preload` fica de FORA de propósito. Entrar na lista de preload dos
 * navegadores é fácil e sair leva meses — e vale para o domínio inteiro,
 * incluindo subdomínios que ainda nem existem. É um compromisso para depois
 * de o HTTPS estar estável em produção, não para a primeira entrega.
 */
const UM_ANO_EM_SEGUNDOS = 31_536_000;

function persistirLocale(
  request: NextRequest,
  response: NextResponse,
  locale: "pt" | "en",
): void {
  response.cookies.set(PLATFORM_LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure:
      (request.headers.get("x-forwarded-proto") ??
        request.nextUrl.protocol.replace(":", "")) === "https",
    sameSite: "lax",
    path: "/",
    maxAge: UM_ANO_EM_SEGUNDOS,
  });
}

function aplicarHsts(request: NextRequest, response: NextResponse): void {
  const protocolo =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");

  if (protocolo === "https") {
    response.headers.set(
      "Strict-Transport-Security",
      `max-age=${UM_ANO_EM_SEGUNDOS}; includeSubDomains`,
    );
  }
}

/**
 * Só duas responsabilidades aqui, de propósito:
 *   1. Renovar a sessão do Supabase a cada requisição (o que mantém os
 *      cookies de auth válidos).
 *   2. Um atalho de UX: sem sessão nenhuma, redireciona direto pra /entrar
 *      em vez de deixar a página protegida renderizar e falhar.
 *
 * O middleware NÃO decide quem é admin nem quem tem matrícula — isso exige
 * consultar o banco (user_roles/enrollments), e fazer isso aqui rodaria em
 * toda requisição, inclusive as que nem batem em rota protegida. A
 * autorização de verdade mora nos layouts protegidos
 * (src/app/(app)/aluno/layout.tsx e src/app/(app)/admin/layout.tsx), via
 * requireUser()/requireAdmin() em src/lib/auth/session.ts.
 */
export async function middleware(request: NextRequest) {
  const localeParam = request.nextUrl.searchParams.get("locale");
  const requestedLocale = isPlatformLocale(localeParam) ? localeParam : null;

  // A landing inglesa já aponta para /entrar?locale=en e /cadastro?locale=en.
  // Atualizar também os cookies da requisição faz a primeira renderização da
  // plataforma usar o idioma certo, sem flash em português.
  if (requestedLocale) {
    request.cookies.set(PLATFORM_LOCALE_COOKIE, requestedLocale);
  }

  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    if (requestedLocale) persistirLocale(request, response, requestedLocale);
    aplicarHsts(request, response);
    return response;
  }

  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient(url as string, publishableKey as string, {
    // Os MESMOS atributos usados em src/lib/supabase/server.ts. Se os dois
    // divergirem, a última escrita ganha e a proteção some sem avisar.
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Não trocar por getSession(): getUser() revalida o token contra o
  // servidor do Supabase Auth em vez de só ler o cookie, e é essa chamada
  // que efetivamente renova a sessão.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !user) {
    const loginUrl = new URL("/entrar", request.url);
    // Só path + query da própria origem — nunca uma URL completa, pra não
    // virar um redirect aberto via ?next=https://outrosite.com.
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    const redirecionamento = NextResponse.redirect(loginUrl);
    if (requestedLocale) persistirLocale(request, redirecionamento, requestedLocale);
    aplicarHsts(request, redirecionamento);
    return redirecionamento;
  }

  // O perfil continua sendo a fonte de verdade quando existe sessão. O
  // parâmetro só persiste a escolha de visitantes ainda não autenticados.
  if (requestedLocale && !user) {
    persistirLocale(request, response, requestedLocale);
  }

  aplicarHsts(request, response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
