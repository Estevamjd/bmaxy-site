import type { CookieOptionsWithName } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * =============================================================================
 *  ATRIBUTOS DO COOKIE DE SESSÃO
 * =============================================================================
 *
 *  Existe um cookie de sessão só — `sb-<ref>-auth-token`, ~2,6 KB, guardando
 *  access token e refresh token. Ele é escrito em DOIS lugares
 *  (`src/lib/supabase/server.ts` e `src/middleware.ts`), e os dois precisam
 *  usar exatamente estes atributos: se um escrever sem `httpOnly` depois de o
 *  outro ter escrito com, a última escrita ganha e a proteção some sem avisar.
 *  É por isso que isto é um módulo, e não uma constante copiada duas vezes.
 *
 *  ---------------------------------------------------------------------------
 *  httpOnly: por que dá para ligar aqui, e não daria em outro projeto
 *  ---------------------------------------------------------------------------
 *  O padrão do @supabase/ssr é `httpOnly: false`, e não por descuido: o
 *  cliente de NAVEGADOR do Supabase (`createBrowserClient`) lê a sessão de
 *  `document.cookie`. Ligar httpOnly num projeto que usa esse cliente quebra
 *  login, refresh e logout de uma vez.
 *
 *  Neste projeto ele não é usado. `src/lib/supabase/client.ts` existe, mas
 *  nenhum arquivo o importa — verificado por grep em todo o `src`. Toda
 *  conversa com o Supabase acontece no servidor: Server Components, Server
 *  Actions, o Route Handler de callback e o middleware. O navegador nunca
 *  precisa ler o token.
 *
 *  O que se ganha: hoje um XSS lê `document.cookie` e leva a sessão inteira
 *  (access + refresh token) para outro domínio. Com httpOnly, o mesmo XSS
 *  ainda faz estrago dentro da página, mas não consegue EXFILTRAR a sessão
 *  para uso posterior fora do navegador da vítima. É a diferença entre um
 *  incidente com fim e uma conta comprometida por tempo indeterminado.
 *
 *  Se um dia alguém precisar do cliente de navegador — Realtime, Storage
 *  direto do browser —, esta decisão precisa ser revisada JUNTO, não depois.
 *
 *  ---------------------------------------------------------------------------
 *  secure: por que NÃO é `NODE_ENV === "production"`
 *  ---------------------------------------------------------------------------
 *  Essa é a armadilha óbvia. `npm run build && npm run start` roda com
 *  `NODE_ENV=production` em `http://localhost:3000` — e um cookie `Secure`
 *  sobre HTTP é simplesmente descartado pelo navegador. O login pararia de
 *  funcionar localmente, no build que mais se testa antes de publicar, com um
 *  sintoma mudo: nenhum erro, a sessão só não persiste.
 *
 *  O sinal correto é o PROTOCOLO, e o projeto já o tem declarado em
 *  `NEXT_PUBLIC_SITE_URL` (http://localhost:3000 em desenvolvimento,
 *  https://bmaxy.com em produção). Em produção o cookie é `Secure`; em
 *  localhost, não.
 *
 *  ---------------------------------------------------------------------------
 *  sameSite: `lax`, que já era o padrão
 *  ---------------------------------------------------------------------------
 *  `strict` quebraria o retorno dos links de e-mail (recuperação de senha e
 *  confirmação de cadastro): o clique vem de outro contexto, e com `strict` o
 *  cookie não é enviado na primeira requisição. `none` exigiria `Secure` e
 *  abriria CSRF entre sites. `lax` é o valor certo aqui — está explícito para
 *  que ninguém precise adivinhar o padrão da biblioteca.
 * =========================================================================== */

export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: getSupabaseEnv().siteUrl.startsWith("https://"),
  sameSite: "lax",
  path: "/",
};
