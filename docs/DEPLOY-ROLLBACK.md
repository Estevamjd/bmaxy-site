# Deploy e rollback

> ### ⚠️ Correção de uma versão anterior deste documento
>
> Este arquivo já afirmou que "nada foi publicado". **Já não é verdade:**
> existe produção no ar em `bmaxy-site.vercel.app`.
>
> O que continua verdade é o escopo de quem escreve este documento: **nenhum
> deploy, promoção ou alteração de domínio foi executado a partir daqui.** A
> publicação existente foi feita por outro caminho.

**Estado atual:**

| | Situação |
| --- | --- |
| Produção | **no ar** em `bmaxy-site.vercel.app` |
| Domínio próprio | `bmaxy.com` **não** apontado — nenhuma alteração de DNS |
| PR #9 | aberta, **sem merge** |

A consequência prática de já haver produção: **este documento deixou de ser
teórico.** O checklist abaixo passa a valer para a próxima promoção, e o
rollback descrito é o caminho real caso algo entre quebrado.

---

## O fluxo

```
push na branch  →  Preview Deployment  →  revisão  →  promover para produção
                                                            ↓ (se der errado)
                                                     Instant Rollback
```

### 1. Preview Deployment

Todo push numa branch com PR aberto gera um Preview com URL própria. É onde se
testa de verdade: mesma build de produção, mesmas variáveis (se configuradas
para Preview), sem afetar a produção em `bmaxy-site.vercel.app`.

O CI (`.github/workflows/ci.yml`) roda em paralelo. **Preview verde e CI verde
são coisas diferentes** — o Preview prova que compila e sobe; o CI prova que
lint, tipos, 169 testes unitários e as 69 asserções de navegação passam.

### 2. Promoção — o mesmo artefato, sem rebuild

Na Vercel: **Deployments** → escolher o deployment aprovado → **Promote to
Production**.

**Por que promover em vez de fazer deploy de novo da branch:** um rebuild do
mesmo commit pode não produzir o mesmo resultado. As dependências resolvem
diferente (um `^` que subiu de versão), o horário entra em conteúdo gerado, o
cache do build está em outro estado. O artefato que você testou no Preview é o
artefato que precisa ir para produção — não "o mesmo código", o **mesmo
build**.

Rebuildar transforma "testei isso" em "testei algo parecido com isso".

### 3. Rollback

**Deployments** → localizar o deployment anterior que estava bom →
**Instant Rollback**.

Instantâneo porque não rebuilda: a Vercel só reaponta o domínio para um
artefato que já existe. É por isso que o item 2 importa — o rollback só é
confiável se a promoção também foi por artefato.

---

## Quando o rollback do código NÃO resolve

**Se uma migration já rodou, voltar o código não volta o banco.**

O código anterior vai encontrar um schema que ele não conhece. Dependendo da
migration, isso vai de "funciona por sorte" a "erro em toda página".

Migration é para frente. Não existe "desfazer" seguro depois que dado novo já
foi escrito no formato novo.

### O que fazer

| Situação | Ação |
| --- | --- |
| Migration **aditiva** (coluna ou tabela nova, função nova) | O rollback do código funciona. O schema fica na frente, e código antigo ignora o que não conhece. |
| Migration **destrutiva** (remove ou renomeia coluna, muda tipo) | Rollback do código **não** resolve. Precisa de uma migration de correção, para frente. |
| Migration mudou RLS ou grants | Avaliar caso a caso: pode ser que o código antigo perca acesso a algo. |

### A regra que evita o problema

**Migration destrutiva nunca vai junto com o código que depende dela.** Separe
em duas entregas:

1. Migration aditiva + código que funciona com o schema velho **e** com o novo.
2. Depois de estável, a migration que remove o que sobrou.

É mais trabalho e é o que mantém o rollback disponível. Este projeto já fez
isso na prática: `private_lesson_media` removeu colunas de `lessons`, e o
`docs/SETUP-MVP.md` registra que aplicar a migration sem subir o código — ou o
contrário — quebra as duas pontas.

---

## Checklist antes de promover

- [ ] CI verde na branch (lint, typecheck, 169 unitários, build, audit, 69 E2E)
- [ ] Preview aberto e navegado à mão: home, uma interna, um livro, pt e en
- [ ] Login administrativo funcionando no Preview
- [ ] Se há migration nesta entrega: ela é aditiva? Se não, o plano de duas
      etapas foi seguido?
- [ ] Variáveis de ambiente novas já configuradas em **Production** (não só em
      Preview) — este é o esquecimento mais comum, e o sintoma é a plataforma
      inteira cair no modo "em configuração"
- [ ] `docs/MIGRATIONS.md` atualizado, se o ledger mudou

---

## Variáveis de ambiente em produção

Só os **nomes**. Os valores vivem no painel da Vercel e em nenhum outro lugar.

| Variável | Vai ao navegador? |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sim |
| `SUPABASE_SECRET_KEY` | **nunca** |
| `NEXT_PUBLIC_SITE_URL` | sim |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | sim |
| `TURNSTILE_SECRET_KEY` | **nunca** |
| `CATALOGO_OBRIGATORIO` | não (só no build) |

### ⚠️ `CATALOGO_OBRIGATORIO=1` é obrigatória em Production

Sem ela, um build feito enquanto o Supabase estiver instável publica `/livros`
e `/en/books` **vazias** — e elas ficam vazias. Foi medido, não deduzido:

1. build com o banco inacessível → a vitrine é gerada sem livro nenhum;
2. o banco volta e o servidor sobe normalmente;
3. cinco requisições seguidas a `/livros` → **zero livros nas cinco**.

O `revalidate` de uma hora não socorre, porque ele declara a página FRESCA por
uma hora. O resultado seria uma loja sem produtos, sem erro em lugar nenhum,
por até sessenta minutos.

Com `CATALOGO_OBRIGATORIO=1`, a leitura é tentada três vezes com espera
crescente e, se ainda assim falhar, **o build falha**. Um deploy que não
acontece é recuperável em minutos; uma vitrine vazia publicada em silêncio,
não.

A variável NÃO é definida no CI de propósito: lá o build roda contra um
projeto Supabase fictício, e exigir catálogo tornaria impossível provar que a
aplicação compila sem segredos.

**Ao configurar o projeto na Vercel:** marque-a apenas em *Production*. Em
*Preview* ela é opcional — um preview com catálogo vazio é um incômodo, não um
incidente.

`NEXT_PUBLIC_SITE_URL` merece atenção: além dos links de e-mail, é ele que
decide se o cookie de sessão é `Secure` e se o Turnstile é obrigatório. Em
produção precisa começar com `https://`. Se ficar em `http://`, os dois
endurecimentos se desligam em silêncio.

---

## O que ainda não existe

- **Domínio próprio**: `bmaxy.com` não foi apontado — a produção responde pelo
  endereço `.vercel.app`. Nenhuma alteração de DNS foi feita a partir deste
  escopo.
- **Proteção de branch** no GitHub exigindo o CI verde para merge — precisa ser
  ligada no painel do repositório.
- **Alerta de falha de deploy** (Slack, e-mail) — integração da Vercel.
- **Primeira promoção documentada**: a produção atual não passou pelo checklist
  acima. A próxima deve passar.
