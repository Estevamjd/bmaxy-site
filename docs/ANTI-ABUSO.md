# Proteção contra abuso

Cobre `/cadastro`, `/entrar` e `/recuperar-senha` — os três formulários que
qualquer um alcança sem estar logado.

**Nada foi habilitado em painel nesta entrega.** O código está pronto e
inerte: sem as chaves, o desafio fica desligado em desenvolvimento e as ações
falham em produção.

---

## 1. Cloudflare Turnstile

### Obter as chaves

1. <https://dash.cloudflare.com> → **Turnstile** → **Add site**.
2. Domínio: `bmaxy.com`. Acrescente `localhost` se quiser testar o widget
   localmente.
3. Widget mode: **Managed** (a Cloudflare decide quando mostrar desafio).
4. Copie as duas chaves: **Site Key** e **Secret Key**.

### Configurar na Vercel

Project → Settings → Environment Variables:

| Nome | Valor | Ambientes |
| --- | --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | site key | Production, Preview |
| `TURNSTILE_SECRET_KEY` | secret key | Production, Preview |

A site key é pública por definição — ela fica no HTML do widget. A secret
**nunca** pode receber o prefixo `NEXT_PUBLIC_`: ela é lida só em
`src/lib/security/turnstile.ts`, que é `server-only`. Se algum dia esse módulo
for importado por um Client Component, o build falha em vez de vazar.

### Como o código se comporta

| Situação | O que acontece |
| --- | --- |
| Chaves presentes | Desafio validado contra a Cloudflare antes de qualquer chamada ao Supabase |
| Sem chaves, `NEXT_PUBLIC_SITE_URL` em `http://` | Desafio **desligado** — o site continua utilizável em desenvolvimento |
| Sem chaves, `NEXT_PUBLIC_SITE_URL` em `https://` | Ação **recusada** — falha fechada |
| Cloudflare fora do ar / timeout | Ação recusada, com mensagem de "tente de novo" |
| Token já usado (`timeout-or-duplicate`) | Mensagem de "a verificação expirou", não de "você é um robô" |

O critério de "é produção?" é o `https://` de `NEXT_PUBLIC_SITE_URL`, **não**
`NODE_ENV`. `npm run build && npm start` roda como produção em localhost; se o
critério fosse `NODE_ENV`, ninguém conseguiria testar o build local sem uma
conta na Cloudflare.

### O que decidimos quando não dá para verificar

Cloudflare indisponível → **bloqueia**, com mensagem de tentar de novo.

É uma escolha com custo, e está isolada em `TurnstileResult` para ser fácil de
reverter. O raciocínio: estes três formulários não são o produto. Uma
indisponibilidade de minutos em login e cadastro é incômoda; uma janela aberta
de força bruta é um incidente.

---

## 2. Supabase Auth Rate Limits

**Onde:** Dashboard → **Authentication** → **Rate Limits**.

Limites atuais do Supabase e o que recomendo para este projeto:

| Endpoint | Padrão | Ajustável? | Recomendação |
| --- | --- | --- | --- |
| Envio de e-mail (cadastro, recuperação) | **2 por hora**, no projeto inteiro | Só com SMTP próprio | **É o gargalo real.** Ver abaixo. |
| Verificação (login com senha) | 360/h por IP | Não | — |
| Refresh de token | 1800/h por IP | Não | — |
| Reenvio de confirmação | 60 s por usuário | Sim | Manter |
| Reset de senha | 60 s por usuário | Sim | Manter |
| Login anônimo | 30/h por IP | Não | Não usamos |

### O limite de e-mail é o que precisa de decisão

**2 e-mails por hora no projeto inteiro** — não por usuário. Com o SMTP
embutido do Supabase, o terceiro cadastro da hora não recebe o e-mail de
confirmação e a pessoa fica sem conseguir entrar, sem erro visível na tela.

Isso não é abuso: é o comportamento normal assim que houver três cadastros
numa hora. **Antes de abrir o cadastro ao público é preciso configurar um SMTP
próprio** (Resend, Postmark, SES), e aí o limite passa a ser configurável.

Enquanto o SMTP embutido estiver em uso, o cadastro público não está pronto
para volume — independentemente do Turnstile.

### IP forwarding

Os limites por IP dependem de o Supabase enxergar o IP real. Atrás da Vercel,
quem chega é o proxy. Existe uma opção de **IP forwarding** no dashboard;
sem ela, os limites por IP contam a plataforma inteira como um único cliente.
Verificar antes de confiar nesses números.

---

## 3. Vercel Firewall — regra futura

**Não configurada.** Caminho: Project → **Firewall** → **Rate Limiting** →
*Add Rule*.

Regra sugerida, para quando o cadastro abrir:

| Campo | Valor |
| --- | --- |
| Path | `/entrar`, `/cadastro`, `/recuperar-senha` |
| Método | `POST` |
| Limite | 10 requisições / 60 s |
| Chave | IP |
| Ação | Challenge (não Deny) |

**Challenge, não Deny**: um bloqueio duro pega junto quem compartilha IP —
escritório, operadora móvel, VPN corporativa. Um desafio deixa a pessoa
legítima passar.

Isto complementa o Turnstile, não substitui: o Turnstile filtra automação, o
firewall filtra volume.

---

## 4. Por que não há rate limiter no código

Um `Map` em memória, ou qualquer contador guardado na instância, **não
funciona em serverless** — cada instância tem a própria memória, o atacante é
distribuído entre várias, e o contador zera a cada cold start. Pior: dá a
sensação de proteção sem proteger, o que é o modo mais caro de errar.

Rate limiting de verdade exige estado compartilhado (Redis, Upstash) ou a
camada de borda. Aqui fica com o Supabase e o Vercel Firewall.

---

## 5. Checklist de ativação

- [ ] Criar o site no Turnstile e obter as duas chaves
- [ ] Configurar as duas variáveis na Vercel (Production e Preview)
- [ ] **Configurar SMTP próprio no Supabase** — sem isso o cadastro público
      esbarra em 2 e-mails/hora
- [ ] Revisar Authentication → Rate Limits depois do SMTP
- [ ] Verificar o IP forwarding
- [ ] Criar a regra de rate limiting no Vercel Firewall
- [ ] Testar em Preview antes de promover: cadastro, login, recuperação, e o
      reenvio depois de um erro de senha (é o caso do token de uso único)
