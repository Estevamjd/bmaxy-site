# Documentos jurídicos — Termos de Uso e Política de Privacidade

**Leia isto antes de considerar as páginas `/termos` e `/privacidade`
prontas para o lançamento comercial.**

---

## 1. O que estes documentos são (e o que não são)

O que está publicado hoje em `/termos`, `/privacidade`, `/en/terms` e
`/en/privacy` são **minutas técnicas iniciais**, escritas a partir dos
dados oficiais fornecidos pelo cliente e do que o código do projeto de
fato faz.

Elas existem porque o formulário de cadastro (`/cadastro`) já **exige** o
aceite dos dois documentos: até agora a pessoa marcava "li e aceito" e
caía num placeholder. Isso era o problema a corrigir, e está corrigido.

O que estas minutas **não** são:

- Não são peça redigida por advogado.
- Não garantem conformidade com LGPD, GDPR, CCPA ou qualquer outra lei.
  Os textos **descrevem direitos** e **dizem como exercê-los** — em
  nenhum ponto afirmam que a empresa está em conformidade com uma
  legislação específica, porque isso não foi verificado por ninguém
  habilitado.
- Não substituem contrato de prestação de serviço para consultoria e
  ghostwriting (que, segundo os próprios Termos, são combinados por
  escrito caso a caso).

**Antes de abrir vendas, estes dois documentos precisam de:**

1. aprovação do cliente, item por item;
2. revisão por advogado com atuação nos Estados Unidos (a empresa é uma
   LLC da Flórida) e, de preferência, alguém que conheça direito do
   consumidor brasileiro — a maior parte do público paga em reais e mora
   no Brasil.

---

## 2. Onde o conteúdo vive

| Arquivo | Papel |
| --- | --- |
| `src/content/legal.ts` | Texto integral dos dois documentos, nos dois idiomas. Única fonte. |
| `src/app/(pt)/termos/page.tsx` | Rota PT dos Termos. |
| `src/app/(pt)/privacidade/page.tsx` | Rota PT da Política de Privacidade. |
| `src/app/en/terms/page.tsx` | Rota EN dos Termos. |
| `src/app/en/privacy/page.tsx` | Rota EN da Política de Privacidade. |

Regras que valem para qualquer alteração:

- **Nenhuma string jurídica dentro de JSX.** Mesma regra de
  `src/content/site.ts`.
- **Equivalência PT/EN é obrigatória.** Não pode existir cláusula em um
  idioma que não exista no outro. `pt.terms.sections[n]` e
  `en.terms.sections[n]` são a mesma cláusula.
- Os `id` de âncora são **idênticos** nos dois idiomas (`#refund`,
  `#cookies`…). É o que faz um link compartilhado continuar apontando
  para a cláusula certa depois da troca de idioma.
- Ao mudar qualquer texto, atualize `updatedAt` e `updatedAtISO` nos
  **quatro** documentos.

---

## 3. Dados oficiais usados

Estes são os únicos dados cadastrais válidos, e todos vêm da constante
`legalEntity` em `src/content/legal.ts`:

- **BMAXY LLC**, sociedade constituída no estado da Flórida, EUA.
- Endereço comercial: **330 E Central Blvd, Orlando, FL 32801**.
- E-mail único de contato: **contact@bmaxy.com**.
- Legislação aplicável: **Flórida, Estados Unidos**.

Não há telefone, segundo e-mail, formulário de contato nem encarregado de
dados (DPO) nomeado — e os documentos **dizem isso**, em vez de inventar.

**EIN:** a empresa possui, mas o número não foi fornecido. Os dois
documentos afirmam que o EIN existe e que o número "é informado quando
houver exigência legal, fiscal ou contratual". **Nunca escreva um número
de EIN aqui sem receber o número real do cliente.**

---

## 4. O que ainda depende de decisão do cliente

Cada item abaixo aparece hoje nas páginas dentro de um bloco destacado
("ainda não está definido"). Assim que o cliente decidir, o bloco sai e
vira texto normal.

### 4.1 Planos de acesso — `#plans` nos Termos

- [ ] **Preço** de cada plano.
- [ ] **Moeda** de cobrança (BRL, USD, ou os dois).
- [ ] **Duração exata** do plano de tempo limitado.
- [ ] **Definição de "acesso vitalício"**: vitalício em relação a quê?
      Enquanto o curso for oferecido pela BMaxy? Sem prazo, com garantia
      de conteúdo futuro? Esta é a definição de maior risco jurídico dos
      dois documentos e precisa sair do cliente por escrito.

> Hoje o texto diz que existirão dois planos (tempo limitado e vitalício),
> com preços diferentes, e que **nada disso é oferta** enquanto não for
> publicado. Acesso vitalício está explicitamente marcado como produto
> ainda não disponível.

### 4.2 Certificado de conclusão — `#certificate` nos Termos

- [ ] **Critérios de emissão**: o que exatamente conta como concluir o
      curso (todas as aulas concluídas? prova? entrega de trabalho?).

> Hoje o texto confirma que haverá certificado, diz que os critérios ainda
> não foram definidos e afirma que o certificado não é diploma e não tem
> reconhecimento acadêmico.

### 4.3 Reembolso — `#refund` nos Termos · **REVISÃO OBRIGATÓRIA**

**Esta é a cláusula que mais precisa de revisão e aprovação final antes de
qualquer venda.** Ela é a única com consequência financeira direta e a
única redigida sobre um critério que ainda não existe.

O que está escrito hoje:

- prazo de **7 (sete) dias** contados da confirmação do pagamento;
- pedido por e-mail, a partir do endereço cadastrado na conta;
- sujeito à **comprovação de boa-fé** no uso do conteúdo;
- devolução pelo mesmo meio de pagamento;
- acesso ao conteúdo encerrado com o reembolso;
- lei local do consumidor prevalece se for mais favorável.

O que **não** foi escrito, de propósito, por falta de decisão do cliente:

- [ ] **Critério objetivo de "boa-fé".** Não existe percentual máximo de
      aulas assistidas, nem qualquer outra métrica, e nenhum foi
      inventado. Enquanto não houver critério, a cláusula é
      discricionária — o que é um risco em disputa de consumo.
- [ ] **Prazo de crédito.** O texto diz apenas que depende do meio de
      pagamento e da instituição financeira. Nenhum prazo em dias foi
      prometido.
- [ ] **Efeito do encerramento por descumprimento sobre valores já
      pagos** (`#termination`). Hoje o documento declara que isso ainda
      não está definido e que cada caso é tratado por e-mail. É uma
      redação provisória aceitável para pré-lançamento, e insustentável
      depois que houver venda.

### 4.4 Pagamentos — `#payments` nos Termos

- [ ] **Confirmar a elegibilidade da conta da BMAXY LLC na Stripe para
      PIX.** O texto diz que PIX "poderá ser oferecido a clientes no
      Brasil, se a conta for elegível" e que **essa elegibilidade ainda
      não foi confirmada**.
- [ ] **Confirmar se Zelle e transferência bancária serão de fato
      aceitos.** O texto os trata como alternativas **separadas**,
      combinadas por e-mail e processadas **fora da Stripe**, e afirma
      explicitamente que *Zelle não é um meio de pagamento da Stripe*.
      Não junte os dois.

> Tudo em `#payments` está escrito no futuro, porque hoje não existe
> checkout nenhum no site.

### 4.5 Retenção de dados — `#retention` na Política de Privacidade

- [ ] **Prazo de guarda dos dados após o encerramento da conta.** Nenhum
      número foi inventado; o texto diz que o prazo depende da obrigação
      legal aplicável e que a pessoa pode perguntar por e-mail. Um
      advogado deve fixar prazos por tipo de registro (fiscal, contábil,
      defesa em disputa).

### 4.6 Provedores citados — `#sharing` na Política de Privacidade

- [ ] **Nomear o provedor de hospedagem.** Hoje o texto diz apenas
      "provedor de hospedagem — infraestrutura de aplicação e entrega do
      site", sem nome. O `README.md` documenta a Vercel como destino de
      deploy, mas isso não foi confirmado como o ambiente de produção
      final, então o nome não foi publicado. Assim que confirmar, troque
      pelo nome real: uma política de privacidade que nomeia os
      suboperadores é bem mais defensável do que uma que os descreve por
      função.

---

## 5. Divergência entre o briefing e o código — precisa de decisão

O briefing desta tarefa dizia que "o vídeo das aulas é entregue pelo
YouTube **em modo restrito**". **O código não faz isso.**

`src/components/platform/LessonPlayer.tsx` carrega
`https://www.youtube.com/iframe_api` e instancia `YT.Player`, o que
incorpora o vídeo a partir de **`www.youtube.com`** — não de
`www.youtube-nocookie.com`, que é o domínio do modo de privacidade
aprimorada. Os `playerVars` usados são apenas `rel: 0`,
`modestbranding: 1` e `origin`; nenhum deles é "modo restrito".

Por isso a Política de Privacidade **não** afirma modo restrito. Ela diz
a verdade verificável: o player é carregado dos servidores do YouTube e,
nesse momento, o Google pode gravar cookies e coletar dados no navegador
da pessoa, segundo as políticas dele — e que isso acontece **dentro da
área do aluno**, não nas páginas públicas.

Duas saídas, e a escolha é do cliente + engenheiro principal:

1. **Trocar o embed para `youtube-nocookie.com`** (mudança pequena no
   `LessonPlayer`, fora do escopo desta tarefa) e então ajustar o texto
   de `#cookies` para refletir isso.
2. **Manter como está** e deixar o texto atual, que já é honesto.

> O restante das afirmações de infraestrutura **foi conferido no código**
> e é verdade: autenticação, banco e sessão no Supabase
> (`src/lib/supabase/*`, `src/middleware.ts`); cookies do site
> estritamente essenciais (só os de sessão do Supabase — não há
> analytics, tag manager, pixel ou qualquer script de medição em
> `src/`); senha nunca visível para a aplicação; RLS no banco; e o vídeo
> de aula bloqueada não chega ao navegador (`get_lesson_playback()`).

---

## 6. Pendências de navegação (não aplicadas nesta tarefa)

Estas mudanças ficam com o engenheiro principal, porque tocam arquivos
fora do escopo desta tarefa:

1. **`src/content/site.ts` — rodapé em inglês.** Os dois links jurídicos
   do rodapé EN ainda apontam para as rotas em português
   (`/privacidade` e `/termos`). Agora que as versões em inglês existem,
   devem apontar para `/en/privacy` e `/en/terms`.
2. **`src/lib/routes.ts` — seletor PT/EN.** `PageKey` não conhece as
   rotas jurídicas, então o botão de idioma, estando em `/termos`, leva
   para a **home** em inglês em vez de `/en/terms`. Acrescentar
   `terms` e `privacy` a `PAGE_PATHS` resolve — e, feito isso, a tabela
   `legalPaths` (em `src/content/legal.ts`) deve ser removida em favor de
   `pagePath()`.
3. **`src/components/StubPage.tsx` e `stubPages` (em `site.ts`) viraram
   código morto.** Eram usados só por estas duas páginas. Nada mais os
   importa.

O rodapé em português já aponta para `/privacidade` e `/termos`, e o
formulário de cadastro também — esses dois estão corretos e não precisam
de mudança (a plataforma é só em português nesta etapa).

---

## 7. Indexação

As quatro páginas são **indexáveis**. Enquanto eram stubs, tinham
`robots: { index: false }`; agora não declaram `robots` e herdam o
`index: true, follow: true` do root layout, exatamente como `/sobre`,
`/livros`, `/consultoria`, `/ghostwriting` e `/curso`.

Cada página declara `canonical` própria e o par `hreflang`
(`pt-BR` / `en-US` / `x-default` → português), no mesmo formato que
`buildPageMetadata` produz para as demais.
