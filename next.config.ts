import type { NextConfig } from "next";

/* =============================================================================
   CABEÇALHOS DE SEGURANÇA
   -----------------------------------------------------------------------------
   Documentação completa (o que cada cabeçalho mitiga, por que cada origem da
   CSP está liberada, e o roteiro para promover a CSP a bloqueante):

       docs/SEGURANCA-CABECALHOS.md

   Regra ao editar: NENHUMA origem entra aqui "por precaução". Cada uma foi
   confirmada lendo o código ou a rede, e está justificada no doc. Se você
   adicionar uma, adicione a justificativa lá junto.
   ========================================================================== */

const isDev = process.env.NODE_ENV === "development";

/**
 * Os dois hosts em que o player do YouTube pode ser embutido.
 *
 * `www.youtube.com` é o que roda hoje: `https://www.youtube.com/iframe_api`
 * devolve `YTConfig = {"host":"https://www.youtube.com"}` e o LessonPlayer não
 * sobrescreve `host`, então o <iframe> criado pela IFrame API sempre aponta
 * para lá.
 *
 * `www.youtube-nocookie.com` NÃO é usado hoje. Entra porque
 * `parseYouTubeVideoId` (src/lib/youtube.ts) já aceita URLs desse host e trocar
 * o player para o modo sem cookies é uma linha (`host` nos playerVars) — uma
 * mudança de privacidade que não deveria esbarrar em CSP.
 */
const YOUTUBE_FRAME_HOSTS = ["https://www.youtube.com", "https://www.youtube-nocookie.com"];

/**
 * CSP — entregue SEMPRE como Content-Security-Policy-Report-Only.
 *
 * Report-Only não bloqueia nada: o navegador só reporta o que teria bloqueado.
 * É de propósito. Ver a seção "Por que Report-Only agora" no doc.
 */
const contentSecurityPolicy = [
  // Rede de segurança para tudo que não tem diretiva própria abaixo
  // (media-src, worker-src, manifest-src...). O site não usa nenhum deles hoje.
  "default-src 'self'",

  // Impede que um <base href> injetado reescreva a base de TODA URL relativa
  // da página — o jeito mais silencioso de sequestrar os chunks do /_next.
  "base-uri 'self'",

  // Nada de <object>/<embed>/<applet>. O site não usa, e são vetores clássicos
  // de execução via plugin.
  "object-src 'none'",

  // Anti-clickjacking. ATENÇÃO: frame-ancestors é IGNORADO em política
  // Report-Only (o Chrome avisa no console). Quem protege de verdade hoje é o
  // X-Frame-Options: DENY abaixo. Esta linha existe para já estar pronta
  // quando a política virar bloqueante.
  "frame-ancestors 'none'",

  // Todo <form> do site posta na própria origem (Server Actions ou GET na
  // mesma página). Bloqueia exfiltração via <form action="https://atacante">.
  "form-action 'self'",

  // ---------------------------------------------------------------------
  // script-src
  //   'self'          → todos os chunks vêm de /_next/static/chunks.
  //   'unsafe-inline' → o Next 15 com RSC emite ~59 <script> inline por
  //                     página (self.__next_f.push do payload de hidratação),
  //                     mais o JSON-LD de StructuredData.tsx. Sem isto (ou
  //                     sem nonce) a página não hidrata. Ver a decisão
  //                     "nonce vs 'unsafe-inline'" no doc.
  //   'unsafe-eval'   → SÓ em desenvolvimento: o HMR do webpack usa eval.
  //                     Nunca vai para produção.
  //   youtube.com     → LessonPlayer injeta
  //                     https://www.youtube.com/iframe_api, que por sua vez
  //                     injeta .../s/player/<hash>/www-widgetapi.vflset/
  //                     www-widgetapi.js — mesmo host (verificado por curl).
  //                     s.ytimg.com NÃO aparece nesse caminho e por isso não
  //                     está liberado.
  //   challenges.cloudflare.com → Turnstile (integração em andamento por
  //                     outra frente). Requisito documentado pela Cloudflare.
  // ---------------------------------------------------------------------
  [
    "script-src 'self' 'unsafe-inline'",
    isDev ? "'unsafe-eval'" : "",
    "https://www.youtube.com",
    "https://challenges.cloudflare.com",
  ]
    .filter(Boolean)
    .join(" "),

  // 'self' = /_next/static/css. 'unsafe-inline' é obrigatório por dois motivos
  // confirmados no HTML gerado: o <style> do fallback de <noscript> para
  // [data-reveal], e os atributos style="--reveal-delay:..." que o React
  // emite (atributo style também cai em style-src).
  "style-src 'self' 'unsafe-inline'",

  // Imagens locais passam por /_next/image (mesma origem). `data:` é a ÚNICA
  // permissão aqui sem uso confirmado no bundle atual — ver justificativa no
  // doc. Não há `blob:` porque não há createObjectURL em lugar nenhum.
  //
  // O host do Supabase entra por causa das capas enviadas pelo painel, que
  // vivem no bucket `book-covers`. Por wildcard, pelo mesmo motivo do
  // connect-src abaixo: a URL real está em NEXT_PUBLIC_SUPABASE_URL e não deve
  // ser fixada em arquivo versionado.
  "img-src 'self' data: https://*.supabase.co",

  // next/font baixa Archivo e Inter no build e serve de
  // /_next/static/media/*.woff2. Nada do Google Fonts em runtime.
  "font-src 'self'",

  // 'self' cobre payload RSC e Server Actions. Supabase por wildcard: a URL
  // real vem de NEXT_PUBLIC_SUPABASE_URL e não deve ser fixada em arquivo
  // versionado. wss:// é para o Realtime (não usado hoje, mesmo host).
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    isDev ? "ws://localhost:* http://localhost:*" : "",
  ]
    .filter(Boolean)
    .join(" "),

  // 'self' cobre iframes de mesma origem (overlay de erro do next dev).
  // YouTube = player da aula. Turnstile = widget do desafio.
  ["frame-src 'self'", ...YOUTUBE_FRAME_HOSTS, "https://challenges.cloudflare.com"].join(" "),
].join("; ");

/**
 * Permissions-Policy.
 *
 * Duas metades: o que o YouTube precisa (delegado a `self` + os hosts do
 * player) e o que fica desligado para todo mundo, inclusive para nós.
 *
 * Um recurso com allowlist vazia `()` não pode ser usado NEM delegado a um
 * iframe. Por isso fullscreen/picture-in-picture/autoplay não podem entrar na
 * lista dos desligados: o <iframe> do player perderia o botão de tela cheia e
 * o modo picture-in-picture.
 */
const YT_ALLOW = `self ${YOUTUBE_FRAME_HOSTS.map((host) => `"${host}"`).join(" ")}`;

const permissionsPolicy = [
  // --- o que o player do YouTube usa (confirmado no `allow` que a IFrame API
  // coloca no <iframe>: accelerometer, autoplay, clipboard-write,
  // encrypted-media, gyroscope, picture-in-picture + allowfullscreen) ---
  `accelerometer=(${YT_ALLOW})`,
  `autoplay=(${YT_ALLOW})`,
  `clipboard-write=(${YT_ALLOW})`,
  `encrypted-media=(${YT_ALLOW})`,
  `fullscreen=(${YT_ALLOW})`,
  `gyroscope=(${YT_ALLOW})`,
  `picture-in-picture=(${YT_ALLOW})`,

  // --- desligados: nada no site pede nenhum destes ---
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "serial=()",
  "hid=()",
  "midi=()",
  "magnetometer=()",
  "display-capture=()",
  "screen-wake-lock=()",
  "idle-detection=()",
  "local-fonts=()",
  "xr-spatial-tracking=()",

  // Publicidade comportamental. `browsing-topics` é a API viva do Chrome;
  // `interest-cohort` é o FLoC, já removido — mantido por compatibilidade
  // histórica ao custo de um aviso "Unrecognized feature" no console.
  "browsing-topics=()",
  "interest-cohort=()",
].join(", ");

const securityHeaders = [
  // Impede o navegador de adivinhar o tipo de um arquivo. Sem isto, um upload
  // ou uma resposta text/plain com HTML dentro pode ser executada como HTML.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Cross-origin só vaza a origem (https://bmaxy.com), nunca o caminho. Importa
  // porque URLs da plataforma carregam ids (/aluno/aula/<uuid>) e o player do
  // YouTube é um destino cross-origin em toda aula.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Proteção anti-clickjacking EFETIVA nesta entrega — o frame-ancestors da
  // CSP não vale porque a política é Report-Only. Ver o doc.
  { key: "X-Frame-Options", value: "DENY" },

  { key: "Permissions-Policy", value: permissionsPolicy },

  // Report-Only: reporta, não bloqueia. Não trocar para
  // "Content-Security-Policy" sem seguir o roteiro de promoção do doc.
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Remove o `X-Powered-By: Next.js`. Não é vulnerabilidade, é reconhecimento
  // gratuito: entrega framework e facilita mirar exploits de versão.
  poweredByHeader: false,

  images: {
    // Todas as imagens do site hoje são SVGs locais gerados em /public/placeholders.
    // O otimizador do Next bloqueia SVG por padrão; como a origem é o próprio
    // repositório (nunca upload de terceiros), liberamos com CSP restritiva.
    //
    // Atenção ao editar os SVGs de /public/placeholders: comentário XML não
    // aceita hífen duplo. Um "--void" dentro de <!-- --> invalida o arquivo
    // inteiro e a imagem simplesmente não renderiza, sem erro no build.
    //
    // Quando o cliente enviar as fotos reais (JPG/WebP), este bloco inteiro pode
    // ser removido.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    // Capas enviadas pelo painel, no bucket público `book-covers`.
    //
    // O caminho é restrito ao bucket de propósito: `pathname: "/**"` deixaria o
    // otimizador do Next buscar QUALQUER objeto público do projeto Supabase,
    // transformando o site num proxy de imagem para o nosso próprio storage.
    //
    // `dangerouslyAllowSVG` acima é o motivo de o bucket recusar SVG no
    // upload. As duas coisas se equilibram: a permissão existe para os
    // placeholders versionados no repositório, e o único caminho por onde
    // chega imagem de fora se recusa a aceitar o formato que executa script.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/book-covers/**",
      },
    ],
  },

  /**
   * Por que aqui e não no middleware: `headers()` alcança TODAS as respostas,
   * inclusive /_next/static/*.js e /_next/image, que o matcher do middleware
   * exclui de propósito (rodar middleware em cada chunk custa invocação e
   * latência). O nosniff nesses arquivos é justamente onde ele mais importa.
   *
   * O peso extra dos cabeçalhos em cada chunk é praticamente nulo sobre
   * HTTP/2: valores idênticos e repetidos entram na tabela dinâmica do HPACK
   * e passam a custar poucos bytes por resposta.
   *
   * O ÚNICO cabeçalho que não está aqui é o Strict-Transport-Security: ele
   * depende do protocolo da requisição e vive em src/middleware.ts.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
