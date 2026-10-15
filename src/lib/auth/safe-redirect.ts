/**
 * =============================================================================
 *  DESTINO INTERNO SEGURO
 * =============================================================================
 *
 *  A versão anterior era uma lista de prefixos proibidos:
 *
 *      !next.startsWith("/")  ||  startsWith("//")  ||  startsWith("/\\")
 *
 *  Lista de proibidos sempre tem mais um caso. Uma auditoria encontrou este,
 *  explorável hoje:
 *
 *      /<TAB>/evil.com
 *
 *  TAB (U+0009) é caractere VÁLIDO no valor de um header HTTP, então o
 *  `Location` sai intacto — e o navegador remove o TAB ao interpretar a URL,
 *  resolvendo para `https://evil.com/`. Pelas três checagens antigas isso
 *  passava: começa com "/", não começa com "//" nem com "/\". As variantes
 *  `/<TAB>\evil.com` e `/<TAB><TAB>//evil.com` neutralizavam, pelo mesmo
 *  truque, as outras duas checagens. E `?next=%0A/x` fazia o Node recusar o
 *  header (ERR_INVALID_CHAR), virando um 500 que qualquer visitante dispara.
 *
 *  A correção não é acrescentar TAB à lista: é parar de usar lista. Agora o
 *  candidato é NORMALIZADO pelo mesmo parser de URL que o navegador usa, e o
 *  que se compara é a ORIGEM resultante. Se sobrou origem diferente da base,
 *  o destino é externo — não importa como foi escrito.
 *
 *  A normalização traz um segundo benefício, que a checagem por string nunca
 *  daria: `/aluno/../admin` vira `/admin`. Sem isso, a verificação de área por
 *  prefixo (ver src/lib/auth/roles.ts) seria contornável escrevendo o caminho
 *  de outro jeito.
 * =========================================================================== */

/** Base sintética. `.invalid` é reservado por RFC — não existe e não resolve. */
const BASE = "https://placeholder.invalid";

/** Um `next` maior que isto não é navegação legítima. */
const MAX_LENGTH = 512;

/** TAB, LF, CR e demais caracteres de controle, incluindo DEL. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/**
 * Devolve o caminho interno já normalizado, ou `null` se o destino não for
 * seguro.
 *
 * `null` em vez de um fallback é proposital: quem chama precisa distinguir
 * "não pediram destino nenhum" de "pediram um destino que não presta", e nos
 * dois casos decidir com informação que só ele tem (a role de quem entrou).
 */
export function normalizeInternalPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (next.length > MAX_LENGTH) return null;

  // É esta linha que fecha o vetor descrito no topo. Vem antes de tudo porque
  // um header com LF/CR nem chega a ser enviado — vira erro 500.
  if (CONTROL_CHARS.test(next)) return null;

  // Backslash em QUALQUER posição, não só no prefixo: o parser de URL trata
  // "\" como separador de caminho, então `/a\..\..\admin` navega para fora do
  // que a string aparenta.
  if (next.includes("\\")) return null;

  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return null;
  }

  // A prova real: depois de normalizado, ainda é o nosso host?
  if (url.origin !== BASE) return null;

  // O hash não é devolvido: ele nunca chega ao servidor e só serviria para
  // carregar lixo até o `Location`.
  return `${url.pathname}${url.search}`;
}

/**
 * Versão com fallback, para quem já tem para onde mandar em caso de recusa.
 * Mantida porque é a forma usada em src/app/auth/callback/route.ts.
 */
export function safeRedirectTarget(
  next: string | null | undefined,
  fallback: string,
): string {
  return normalizeInternalPath(next) ?? fallback;
}
