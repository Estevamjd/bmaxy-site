import "server-only";
import { platformContent, type PlatformLocale } from "@/content/platform";

/**
 * =============================================================================
 *  CLOUDFLARE TURNSTILE — validação no servidor
 * =============================================================================
 *
 *  A chave SECRETA só existe aqui. O `import "server-only"` no topo faz o build
 *  QUEBRAR se este módulo for alcançado a partir de um Client Component — é o
 *  mesmo padrão de `src/lib/supabase/secret.ts`. Só a SITE key é pública, e ela
 *  vive noutro lugar (ver `turnstileSiteKey()` abaixo, que não importa nada
 *  daqui).
 *
 *  ---------------------------------------------------------------------------
 *  Por que o retorno não é booleano
 *  ---------------------------------------------------------------------------
 *  "Reprovado" e "não deu para verificar" exigem respostas diferentes na tela.
 *  Um `false` solto obrigaria quem chama a tratar os dois como a mesma coisa —
 *  ou a pessoa legítima leva "você é um robô" quando na verdade a Cloudflare
 *  ficou fora do ar.
 *
 *  ---------------------------------------------------------------------------
 *  A decisão que mais importa: o que fazer quando não dá para verificar
 *  ---------------------------------------------------------------------------
 *  Se a Cloudflare não responde, existem duas escolhas e as duas custam algo:
 *  bloquear todo mundo (o site fica refém de um serviço de terceiros) ou deixar
 *  passar (a proteção evapora justamente quando alguém pode estar derrubando o
 *  serviço de propósito).
 *
 *  Aqui a escolha é BLOQUEAR, com mensagem de "tente de novo", e está isolada
 *  em `TurnstileResult` para que dê para mudar de ideia num lugar só. O motivo:
 *  estes três formulários não são o produto — são login, cadastro e recuperação
 *  de senha. Uma indisponibilidade de minutos num deles é incômoda; uma janela
 *  aberta de força bruta é um incidente.
 * =========================================================================== */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Quanto tempo esperar a Cloudflare antes de desistir. */
const TIMEOUT_MS = 5_000;

export type TurnstileResult =
  /** Passou, ou a proteção está desligada em desenvolvimento. */
  | { status: "ok" }
  /** O desafio reprovou, ou o token não veio / já tinha sido usado. */
  | { status: "reprovado"; motivo: string }
  /** Não deu para saber: rede, timeout ou erro interno da Cloudflare. */
  | { status: "indisponivel"; motivo: string }
  /** Produção sem a chave configurada — falha fechada, ver abaixo. */
  | { status: "mal_configurado" };

/**
 * A proteção está ligada quando as DUAS chaves existem.
 *
 * Mesma filosofia de `isSupabaseConfigured()`: sem configuração, o projeto
 * continua utilizável em desenvolvimento em vez de quebrar. A diferença é que
 * aqui essa tolerância NÃO pode valer em produção — ver `verificarTurnstile`.
 */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/**
 * Estamos rodando no ambiente onde a proteção é OBRIGATÓRIA?
 *
 * O sinal é o mesmo do cookie `Secure`: o protocolo declarado em
 * `NEXT_PUBLIC_SITE_URL`. `NODE_ENV` não serve — `npm run build && npm start`
 * roda como produção em localhost, e ali a proteção não deve ser obrigatória,
 * senão ninguém consegue testar o build localmente sem chaves da Cloudflare.
 */
export function isTurnstileObrigatorio(): boolean {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
}

type RespostaSiteverify = {
  success: boolean;
  "error-codes"?: string[];
};

/**
 * Valida o token do widget.
 *
 * @param token  O valor de `cf-turnstile-response`, vindo do FormData.
 * @param ip     IP de quem enviou, quando disponível. Opcional na API.
 */
export async function verificarTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<TurnstileResult> {
  if (!isTurnstileConfigured()) {
    /* Sem chaves. Em produção isso é erro de configuração e a ação PRECISA
       falhar: passar batido aqui transformaria "esqueci de configurar" em
       "a proteção nunca existiu", que é o pior dos dois mundos porque ninguém
       percebe. Em desenvolvimento, segue o jogo. */
    return isTurnstileObrigatorio() ? { status: "mal_configurado" } : { status: "ok" };
  }

  if (!token) {
    return { status: "reprovado", motivo: "missing-input-response" };
  }

  /* A API recusa acima de 2048 caracteres. Cortar aqui evita uma ida à rede
     para receber `invalid-input-response` de volta. */
  if (token.length > 2048) {
    return { status: "reprovado", motivo: "invalid-input-response" };
  }

  const corpo = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY as string,
    response: token,
  });
  if (ip) corpo.set("remoteip", ip);

  let dados: RespostaSiteverify;
  try {
    const resposta = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: corpo,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!resposta.ok) {
      return { status: "indisponivel", motivo: `http-${resposta.status}` };
    }
    dados = (await resposta.json()) as RespostaSiteverify;
  } catch {
    // Timeout, DNS, TLS, JSON malformado — tudo cai aqui. Nunca vaze o erro.
    return { status: "indisponivel", motivo: "sem-resposta" };
  }

  if (dados.success) return { status: "ok" };

  const codigos = dados["error-codes"] ?? [];

  /* `internal-error` é a própria Cloudflare pedindo para tentar de novo — é
     indisponibilidade, não reprovação. E `missing-input-secret` /
     `invalid-input-secret` são erro NOSSO de configuração: a pessoa do outro
     lado não fez nada de errado e não deve ser acusada de robô. */
  if (codigos.includes("internal-error")) {
    return { status: "indisponivel", motivo: "internal-error" };
  }
  if (codigos.some((c) => c === "missing-input-secret" || c === "invalid-input-secret")) {
    return { status: "mal_configurado" };
  }

  return { status: "reprovado", motivo: codigos[0] ?? "sem-codigo" };
}

/**
 * Mensagem para a tela. Nunca devolve o código bruto da Cloudflare.
 *
 * `timeout-or-duplicate` merece texto próprio: significa que o token já foi
 * gastado — quase sempre porque o formulário foi reenviado depois de um erro
 * sem o widget ter sido resetado. Dizer "expirou, tente de novo" é honesto e
 * acionável; dizer "você é um robô" seria falso.
 */
export function mensagemTurnstile(
  resultado: TurnstileResult,
  locale: PlatformLocale = "pt",
): string | null {
  const messages = platformContent[locale].actions;
  switch (resultado.status) {
    case "ok":
      return null;
    case "reprovado":
      return resultado.motivo === "timeout-or-duplicate"
        ? messages.securityExpired
        : messages.securityFailed;
    case "indisponivel":
      return messages.securityUnavailable;
    case "mal_configurado":
      // Genérica de propósito: quem está na tela não pode fazer nada a
      // respeito, e o texto não deve revelar como o servidor está configurado.
      return messages.securityFailed;
  }
}
