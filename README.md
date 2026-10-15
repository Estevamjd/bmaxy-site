# BMaxy — site institucional e plataforma de curso

Projeto real desenvolvido para a **BMaxy LLC** (cliente: Rodrigo Gambini), publicado com autorização.

**Problema:** o cliente precisava de uma presença profissional bilíngue e de um lugar próprio para vender e entregar seu curso, sem depender de plataformas de terceiros.

**Funcionalidades:** home institucional PT/EN · login · área do aluno com cursos e aulas · painel administrativo (alunos, matrículas, conteúdo) · proteção anti-bot (Turnstile) · chave secreta isolada no servidor (`server-only`) · testes unitários e CI.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Auth + Postgres + RLS) · Vercel

> Os workflows de CI estão em `docs/*-workflow.yml.example`. Os valores de chave nos testes são fictícios.

---

Site institucional e plataforma de curso da **BMaxy LLC** (bmaxy.com), de
Rodrigo Gambini. Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 ·
Supabase (autenticação e banco).

Duas partes bem separadas:

- **A home** (`/` em português, `/en` em inglês) — página de apresentação,
  sem login, funciona sem nenhuma variável de ambiente.
- **A plataforma** (`/entrar`, `/aluno`, `/admin`) — login, área do aluno e
  painel administrativo, com Supabase. Sem pagamento nesta etapa (matrícula
  é sempre liberada manualmente pelo administrador). Documentação completa
  de ativação em **[docs/SETUP-MVP.md](docs/SETUP-MVP.md)** — comece por
  ali se for configurar o Supabase pela primeira vez.

---

## Rodar

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build      # build de produção
npm start          # serve o build
npm run lint       # ESLint
npm run test:unit  # testes de lógica pura (Node test runner nativo)
```

Requer Node 20+. Sem `.env.local`, a home funciona normalmente e as rotas
da plataforma mostram um aviso de "em configuração" — ver
[docs/SETUP-MVP.md](docs/SETUP-MVP.md).

---

## Trocar o conteúdo — `src/content/site.ts`

**Todo o texto e todo o caminho de imagem do site estão nesse arquivo.** Não há
uma única string escrita dentro de JSX. Para trocar o conteúdo da página
inteira, você só precisa mexer ali — nenhum componente muda.

O arquivo é tipado (`SiteContent`), então o editor avisa se faltar um campo e o
`npm run build` falha antes de o erro chegar ao ar.

Como está organizado:

| Chave          | O que controla                                         |
| -------------- | ------------------------------------------------------ |
| `meta`         | título, descrição, SEO, Open Graph, JSON-LD            |
| `brand`        | a palavra "BMAXY" e a tagline                          |
| `nav`          | itens do menu                                          |
| `headerCta`    | botão dourado do topo (+ rótulo curto para o celular)  |
| `hero`         | primeira tela — as 3 linhas do h1 são um array         |
| `marquee`      | palavras da faixa dourada rolante                      |
| `stats`        | os quatro números                                      |
| `services`     | as quatro linhas numeradas (001–004)                   |
| `books`        | os 6 livros, capas e links de compra                   |
| `course`       | curso "Seu Livro", tópicos, preço e o mockup do player |
| `about`        | biografia                                              |
| `testimonials` | depoimento em destaque + dois menores                  |
| `instagram`    | grade de 6 imagens e o @                               |
| `newsletter`   | isca do material gratuito e textos do formulário       |
| `footer`       | colunas, contato, copyright e links legais             |
| `stubPages`    | textos das páginas "em breve"                          |

### O que ainda é texto provisório

Procure por `TODO: conteúdo real do cliente` no arquivo. Está marcado assim em:
algumas sinopses dos 6 livros, descrições de consultoria e ghostwriting, os
depoimentos (seção oculta enquanto isso) e o pôster/frame da aula 1.

Os dados **verdadeiros** já estão corretos e não precisam de revisão: empresa,
domínio, tagline, preço do curso (R$ 349 / US$ 99), e-mail de contato,
retratos e capas reais, links de Amazon e Clube de Autores por
título, "10+ livros publicados" (o único número confirmado — os outros três
foram removidos em vez de inventados) e @eurodrigogambini.

---

## Cores da marca

As nove cores amostradas da logo ficam em **`src/app/globals.css`**, no `:root`
do topo do arquivo:

```css
--void   #07082A   /* fundo principal */
--deep   #0B117C   /* seções alternadas */
--royal  #101C9C   /* azul da marca */
--violet #7D5DE4   /* acento secundário, uso mínimo */
--gold   #FFC800   /* ACENTO PRINCIPAL */
--gold-hi#FFD84E   /* topo do gradiente da pena */
--bone   #F7F6FB   /* seções claras */
--ash    #A9A6C8   /* texto secundário sobre escuro */
--line   #232152   /* divisórias */
```

Logo abaixo, o bloco `@theme inline` expõe cada uma para o Tailwind, então
`bg-void`, `text-gold`, `border-line` etc. funcionam em qualquer componente.
Mudou o hex no `:root`, mudou no site inteiro.

Há quatro cores derivadas no mesmo bloco, todas comentadas no arquivo:

- `--violet-hi`, `--ink`, `--ink-soft`, `--line-light` — existem por
  acessibilidade. O `--violet` puro tem 4.2:1 sobre o fundo escuro, abaixo do
  mínimo de leitura, por isso ele fica restrito a filetes, molduras e ao
  gradiente do rodapé.
- `--deep-surface` (`#090D57`) — é o `--deep` composto a 55% sobre o `--void`,
  e é ele que pinta as seções azuis (Números, Sobre) e o player do curso. O
  `--deep` puro, sangrando de borda a borda, vira um bloco de azul primário que
  briga com a direção de arte e engole a foto em duotone. **Para voltar ao
  literal do briefing:** troque `bg-deep-surface` por `bg-deep` em
  `Stats.tsx`, `About.tsx` e `Course.tsx`.

Os tamanhos de tipografia também estão nesse arquivo, todos em `clamp()`, na
seção "TIPOGRAFIA" (`t-hero`, `t-section`, `t-service`, `t-course`, ...).

---

## Trocar as imagens

Retratos (`public/people/`) e capas dos livros (`public/livros/`) já são
fotos reais. Só o pôster da aula 1 e a grade do Instagram ainda apontam para
SVGs cinzentos em `public/placeholders/` — sem material real ainda. Nenhum
serviço externo é usado — o site abre inteiro sem internet.

Para colocar as fotos reais:

1. Coloque os arquivos em `public/` (ex.: `public/fotos/retrato-hero.jpg`).
2. No `site.ts`, troque `src`, `width`, `height` e `alt` do item.
   `width` e `height` são os pixels reais do arquivo — é o que evita o layout
   pular durante o carregamento.
3. Mantenha as proporções: capas **2:3**, retratos **3:4**, Instagram **1:1**,
   poster do curso **16:9**.

Quando não houver mais nenhum SVG sendo servido por `next/image`, o bloco
`images` em `next.config.ts` pode ser removido inteiro (ele só existe para o
otimizador aceitar SVG local).

> **Ao editar um SVG de placeholder:** comentário XML não aceita hífen duplo.
> Escrever `--void` dentro de `<!-- -->` invalida o arquivo inteiro e a imagem
> deixa de aparecer — sem nenhum erro no build.

As fotografias recebem um tratamento duotone `--void`/`--violet` por filtro SVG
(`src/components/DuotoneDefs.tsx`), aplicado pela classe `.duotone`. Mande fotos
normais, coloridas — o tratamento é feito no navegador.

---

## Logo

O header **não** usa o arquivo da logo. Ele usa o símbolo em vetor
(`src/components/BrandMark.tsx`) e escreve "BMAXY" ao lado como texto vivo em
Archivo. O motivo está comentado no topo desse arquivo, junto com o passo a
passo para substituir pelo SVG oficial quando o cliente enviar.

O gêmeo estático (favicon e usos em `<img>`) é `public/brand/bmaxy-mark.svg` e
`src/app/icon.svg` — atualize os três juntos.

O arquivo completo da logo (símbolo + nome + tagline) só pode ser usado sobre
fundo `--bone`. Sobre fundo escuro o nome desaparece.

---

## Bilíngue (pt / en)

O site é bilíngue: **"/"** (sem prefixo) é a home em português, o idioma
padrão. **"/en"** é a home em inglês. Só a home é bilíngue — as páginas
internas (`/sobre`, `/livros`, `/consultoria`, `/ghostwriting`, `/curso`,
`/entrar`) continuam só em português.

`site.ts` exporta `siteContent: Record<Locale, SiteContent>` com dois objetos
completos, `pt` e `en`, no mesmo formato. Nenhum componente importa `site`
diretamente — todos recebem o objeto certo via prop:

- `src/app/(pt)/page.tsx` e `src/app/en/page.tsx` passam `site` para
  `HomeSections.tsx`, que distribui para cada seção da home.
- `src/app/(pt)/layout.tsx` e `src/app/en/layout.tsx` passam `site` para
  `AppShell.tsx`, que distribui para `Header`/`Footer`/`StructuredData`.

**Por que dois root layouts em vez de `src/app/[locale]/`:** só o root layout
pode definir `lang` no `<html>`, e o inglês precisa ficar em "/en" sem que o
português ganhe um prefixo "/pt" — é exatamente o caso de uso do recurso
"múltiplos root layouts" do App Router (via route groups). `(pt)` é um route
group (não aparece na URL); `en` é uma pasta normal. Cada um tem seu próprio
`layout.tsx`, que só chama `AppShell` com `site`/`locale` diferentes — o
markup em si não se duplica.

O header e o rodapé do inglês não linkam para as páginas internas em
português (isso seria confuso e criaria uma mistura de idiomas no meio da
navegação). Em vez disso, `nav`, `headerCta`, `services.items`, `course.cta`
etc. dentro do objeto `en` apontam para âncoras da própria home em inglês
(`/en#livros`, `/en#curso`, `/en#servicos`, `/en#sobre`). A única exceção é
`studentArea` (login), que não tem seção equivalente na home — reusa a
mesma rota `/entrar` que o português já usa.

Para adicionar um terceiro idioma: acrescente o código em `Locale` (topo de
`site.ts`), escreva o objeto de conteúdo completo, adicione `src/app/<code>/
layout.tsx` e `page.tsx` seguindo `src/app/en/` como modelo, e inclua o
idioma em `buildLayoutMetadata` (`src/lib/metadata.ts`) e nos dois
`opengraph-image.tsx`.

---

## Subir na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Em vercel.com → **Add New… → Project** → importe o repositório.
3. A Vercel detecta Next.js sozinha; o build é o padrão (`npm run build`).
4. Para a **plataforma** (login/aluno/admin) funcionar, configure as 4
   variáveis de ambiente do Supabase em Settings → Environment Variables —
   passo a passo completo em [docs/SETUP-MVP.md](docs/SETUP-MVP.md). Sem
   elas, o build passa normalmente e a home funciona; só a plataforma
   mostra o aviso de "em configuração".
5. Depois do primeiro deploy, em **Settings → Domains**, aponte `bmaxy.com`.
6. Troque `meta.url` no `site.ts` se o domínio final for outro — é dele que
   saem a URL canônica, o Open Graph e o JSON-LD.

---

## Estrutura

```text
src/
  middleware.ts           renova sessão do Supabase + atalho de redirect
  app/
    globals.css          tokens de cor, tipografia, animações
    fonts.ts             Archivo (display) e Inter (corpo)
    icon.svg             favicon (compartilhado por todos os root layouts)
    (pt)/                route group — home em português, root layout próprio
      layout.tsx sobre|livros|consultoria|ghostwriting|curso|privacidade|termos/
    en/                  home em inglês ("/en"), root layout próprio
    (app)/               PLATAFORMA — root layout próprio, force-dynamic
      layout.tsx          só <html>/<body>; cada área desenha seu chrome
      entrar/ recuperar-senha/ redefinir-senha/ acesso-negado/
      aluno/               layout.tsx roda requireUser(); dashboard, curso, aula
      admin/               layout.tsx roda requireAdmin(); alunos, cursos
    auth/callback/route.ts  troca o code do link de e-mail por sessão
  components/
    AppShell.tsx, HomeSections.tsx, LanguageSwitch.tsx, StructuredData.tsx,
    (demais)              seções da HOME, todas recebem `site` via prop
    platform/             UI da PLATAFORMA (form, sidebar, player de aula) —
                           sem relação com o conteúdo bilíngue da home
  content/site.ts        ← todo o conteúdo da HOME, pt e en
  lib/
    metadata.ts, og-image.tsx, reveal.ts   ajudantes da home
    supabase/              client.ts (navegador) · server.ts (RSC/actions,
                            getAll/setAll) · admin.ts (service role,
                            server-only) · types.ts (Database) · env.ts
    auth/session.ts        requireUser()/requireAdmin() — a autorização de
                            verdade, nunca só o middleware
    auth/safe-redirect.ts  valida ?next= (impede redirect aberto)
    dal/student.ts, dal/admin.ts   toda leitura/escrita do banco
    actions/auth.ts, actions/admin.ts, actions/progress.ts   Server Actions
    validation/            schemas Zod de cada action
supabase/
  migrations/             schema + RLS + is_admin() + triggers
  seed.sql                curso/módulo/aula 1 de desenvolvimento
public/
  brand/, people/, livros/   material real
  placeholders/              o que ainda não tem material real (poster do
                             curso, grade do Instagram)
```

Arquitetura completa da plataforma (Supabase, RLS, fluxo de auth) em
[docs/SETUP-MVP.md](docs/SETUP-MVP.md).

---

## Notas técnicas

- **Animação**: só CSS + um `IntersectionObserver` (`RevealObserver.tsx`).
  Nenhuma biblioteca de animação ou de scroll. A faixa dourada rolante é 100%
  CSS. Tudo respeita `prefers-reduced-motion`.
- **Ícones**: todos desenhados à mão em `src/components/icons.tsx`. Nenhuma
  biblioteca de ícones.
- **A seção de newsletter não é renderizada na home** (ver `HomeSections.tsx`):
  o formulário nunca enviou nada de verdade, e prometer "material gratuito"
  que não chega é enganoso. Componente e conteúdo continuam em
  `src/components/Newsletter.tsx`, prontos para religar quando houver um
  serviço de e-mail de verdade por trás do `handleSubmit`.
- **Os links de compra (Amazon e Clube de Autores) já apontam para a URL
  real de cada livro**, definidas pelo cliente — ver `books.items` em
  `src/content/site.ts`.
