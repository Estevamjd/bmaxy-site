# Cabeçalhos de segurança e CSP

Implementados em `next.config.ts` (todos, exceto um) e `src/middleware.ts`
(só o HSTS, que depende do protocolo da requisição).

Verificado em build de produção com `curl -I`. Data: 2026-08-05.

---

## Por que quase tudo em `next.config.ts` e não no middleware

`headers()` alcança **todas** as respostas, inclusive `/_next/static/*.js` e
`/_next/image` — que o `matcher` do middleware exclui de propósito, porque
rodar middleware em cada chunk custa invocação e latência. E `nosniff` nesses
arquivos é justamente onde ele mais importa.

O peso de repetir os cabeçalhos em cada chunk é praticamente nulo sobre
HTTP/2: valores idênticos entram na tabela dinâmica do HPACK e passam a custar
poucos bytes.

---

## Os cabeçalhos

| Cabeçalho | Valor | O que mitiga |
| --- | --- | --- |
| `X-Powered-By` | **removido** | Não é vulnerabilidade — é reconhecimento gratuito. Entregava o framework e facilitava mirar exploits de versão. |
| `X-Content-Type-Options` | `nosniff` | Impede o navegador de adivinhar o tipo de um arquivo. Sem ele, uma resposta `text/plain` com HTML dentro pode ser executada como HTML. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Cross-origin vaza só a origem, nunca o caminho. Importa porque as URLs da plataforma carregam ids (`/aluno/aula/<uuid>`) e toda aula embute um destino cross-origin (YouTube). |
| `X-Frame-Options` | `DENY` | Clickjacking. |
| `Permissions-Policy` | ver abaixo | Desliga APIs de dispositivo que o site não usa. |
| `Content-Security-Policy-Report-Only` | ver abaixo | Só reporta, não bloqueia. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Só em HTTPS. Força HTTPS por um ano. |

### Por que `X-Frame-Options` **e** `frame-ancestors`

`X-Frame-Options` é formalmente obsoleto e `frame-ancestors` é o substituto.
Só que **`frame-ancestors` é ignorado em política `Report-Only`** — o
navegador avisa isso no console. Como a CSP nasce em Report-Only, hoje quem
protege de verdade é o `X-Frame-Options: DENY`.

Os dois convivem: quando a CSP virar bloqueante, `frame-ancestors` assume e o
`X-Frame-Options` vira redundância inofensiva para navegadores antigos.

### HSTS: por que não está no `next.config.ts`

Depende do protocolo, e mandá-lo por HTTP é **pior do que não mandar**: em
desenvolvimento o navegador grava a regra para `localhost` e passa a forçar
HTTPS em *todo* projeto naquela porta, por meses, sem jeito óbvio de desfazer
fora de `chrome://net-internals`.

Atrás do proxy da Vercel a requisição chega como HTTP; quem diz a verdade é
`x-forwarded-proto`. Confirmado em build local: o cabeçalho **não** aparece em
`http://localhost:3000`.

**`preload` ficou de fora de propósito.** Entrar na lista de preload dos
navegadores é fácil e sair leva meses — e vale para o domínio inteiro,
incluindo subdomínios que ainda não existem. É compromisso para depois de o
HTTPS estar estável em produção.

---

## A CSP, diretiva por diretiva

Nenhuma origem entra "por precaução". Cada uma foi confirmada lendo o código
ou observando a rede.

| Diretiva | Origem | Por que está aí — e o que quebra se sair |
| --- | --- | --- |
| `default-src` | `'self'` | Rede de segurança para o que não tem diretiva própria (`media-src`, `worker-src`, `manifest-src`). Nenhum é usado hoje. |
| `base-uri` | `'self'` | Impede que um `<base href>` injetado reescreva a base de toda URL relativa — o jeito mais silencioso de sequestrar os chunks do `/_next`. |
| `object-src` | `'none'` | `<object>`/`<embed>` não são usados e são vetores clássicos de execução via plugin. |
| `frame-ancestors` | `'none'` | Clickjacking. **Inerte enquanto a política for Report-Only.** |
| `form-action` | `'self'` | Todo `<form>` posta na própria origem. Bloqueia exfiltração via `<form action="https://atacante">`. |
| `script-src` | `'self'` | Os chunks vêm de `/_next/static/chunks`. |
| | `'unsafe-inline'` | **Medido: 48 `<script>` inline na home.** É o payload de hidratação do RSC (`self.__next_f.push`) mais o JSON-LD. Sem isto — ou sem nonce — a página não hidrata. |
| | `'unsafe-eval'` *(só em dev)* | O HMR do webpack usa `eval`. Nunca vai para produção. |
| | `https://www.youtube.com` | `LessonPlayer` injeta `iframe_api`, que injeta `www-widgetapi.js` do mesmo host. `s.ytimg.com` **não** aparece nesse caminho e por isso não está liberado. |
| | `https://challenges.cloudflare.com` | Turnstile. |
| `style-src` | `'self' 'unsafe-inline'` | Dois motivos confirmados no HTML: o `<style>` dentro do `<noscript>` que revela `[data-reveal]` sem JS, e os atributos `style="--reveal-delay:…"` que o React emite (atributo `style` também cai em `style-src`). |
| `img-src` | `'self' data:` | Imagens locais passam por `/_next/image`. Não há `blob:` porque não há `createObjectURL` em lugar nenhum. |
| `font-src` | `'self'` | `next/font` baixa Archivo e Inter no build e serve de `/_next/static/media`. Nada do Google Fonts em runtime. |
| `connect-src` | `'self'`, `https://*.supabase.co`, `wss://*.supabase.co` | Payload RSC e Server Actions em `'self'`. Supabase por **wildcard** de propósito: a URL real vem de `NEXT_PUBLIC_SUPABASE_URL` e não deve ser fixada em arquivo versionado. `wss` é o Realtime (não usado hoje, mesmo host). |
| `frame-src` | `'self'`, YouTube, Turnstile | `'self'` cobre o overlay de erro do `next dev`. |

### `nonce` ou `'unsafe-inline'`?

Ficou `'unsafe-inline'`, e a decisão tem custo declarado.

Implementar nonce no Next 15 exige o middleware injetar um valor por
requisição — e isso **desativa o cache estático**. Este site tem páginas
`○ Static` e `● SSG` (home, livros, páginas de livro, jurídicas): todas
passariam a renderizar sob demanda. Trocar-se-ia uma vantagem de desempenho
real e medida por um ganho que, com 48 scripts inline do próprio framework,
seria parcial de qualquer jeito.

Enquanto a política for Report-Only, `'unsafe-inline'` não muda nada na
prática — Report-Only não bloqueia. A decisão só passa a pesar no dia da
promoção, e aí deve ser reavaliada com o tráfego real na mesa.

---

## Como promover a Report-Only a bloqueante

**Não troque o nome do cabeçalho sem cumprir isto.**

1. **Hoje não há endpoint de coleta.** Sem `report-uri`/`report-to`, as
   violações só aparecem no console de quem estiver com o DevTools aberto.
   Enquanto for assim, a política é um exercício — útil para não quebrar nada,
   inútil para descobrir o que quebraria em produção.
2. Antes de promover: escolher um coletor (Report URI, Sentry ou um Route
   Handler próprio), adicionar `report-to` e deixar rodando **pelo menos duas
   semanas** com tráfego real, cobrindo login, área do aluno com vídeo tocando,
   e o painel administrativo.
3. Zerar as violações legítimas uma a uma. Cada uma é ou uma origem que falta,
   ou código que deveria mudar.
4. Só então trocar `Content-Security-Policy-Report-Only` por
   `Content-Security-Policy` — e observar de perto por mais alguns dias.

Promover sem coletor é trocar "não sei o que quebra" por "descubro pelo
suporte".

---

## O que ainda depende de painel

- **Coletor de relatórios de CSP** — decisão de produto (custo) e configuração
  externa.
- **`preload` do HSTS** — só depois de HTTPS estável, e é praticamente
  irreversível.
