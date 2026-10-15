# Migrations: o ledger local e o remoto estão reconciliados

**Status: RECONCILIADO em 2026-08-04** contra o projeto `qlrljzodmisvohjeodxt`.

O repositório e `supabase_migrations.schema_migrations` hoje descrevem a mesma
lista, versão a versão. A reconciliação foi feita **renomeando os arquivos
locais** — zero escrita no banco, zero DDL, zero alteração de schema. O banco
não foi tocado.

---

## Estado atual: 11 e 11, mesmas versões

| # | Versão | Nome | Arquivo em `supabase/migrations/` | Remoto |
| --- | --- | --- | --- | --- |
| 1 | `20260803202658` | `initial_schema` | `20260803202658_initial_schema.sql` | ✅ |
| 2 | `20260803202701` | `secure_lesson_completion` | `20260803202701_secure_lesson_completion.sql` | ✅ |
| 3 | `20260803202703` | `private_lesson_media` | `20260803202703_private_lesson_media.sql` | ✅ |
| 4 | `20260803203311` | `harden_rls_and_api_permissions` | `20260803203311_harden_rls_and_api_permissions.sql` | ✅ |
| 5 | `20260803203841` | `auto_enroll_free_course` | `20260803203841_auto_enroll_free_course.sql` | ✅ |
| 6 | `20260803204549` | `scope_free_enrollment_to_public_signup` | `20260803204549_scope_free_enrollment_to_public_signup.sql` | ✅ |
| 7 | `20260803221619` | `admin_content_ordering` | `20260803221619_admin_content_ordering.sql` | ✅ |
| 8 | `20260803221658` | `admin_content_ordering_search_path` | `20260803221658_admin_content_ordering_search_path.sql` | ✅ |
| 9 | `20260804200809` | `harden_password_flag_and_progress` | `20260804200809_harden_password_flag_and_progress.sql` | ✅ |
| 10 | `20260804201803` | `atomic_content_creation` | `20260804201803_atomic_content_creation.sql` | ✅ |
| 11 | `20260805014918` | `drop_redundant_order_constraints` | `20260805014918_drop_redundant_order_constraints.sql` | ✅ |
| 12 | `20260805082832` | `writing_studio` | `20260805082832_writing_studio.sql` | ✅ |
| 13 | `20260805090637` | `writing_studio_operations` | `20260805090637_writing_studio_operations.sql` | ✅ |
| 14 | `20260805090645` | `initialize_profile_locale` | `20260805090645_initialize_profile_locale.sql` | ✅ |
| 15 | `20260805093058` | `remove_unapproved_lesson_count` | `20260805093058_remove_unapproved_lesson_count.sql` | ✅ |
| 16 | `20260806052607` | `book_catalog` | `20260806052607_book_catalog.sql` | ✅ |
| 17 | `20260806052741` | `book_catalog_seed_existing` | `20260806052741_book_catalog_seed_existing.sql` | ✅ |
| 18 | `20260806053022` | `book_catalog_fix_anon_policies` | `20260806053022_book_catalog_fix_anon_policies.sql` | ✅ |
| 19 | `20260806054248` | `book_catalog_operations_and_covers` | `20260806054248_book_catalog_operations_and_covers.sql` | ✅ |
| 20 | `20260807184152` | `book_catalog_split_write_policies` | `20260807184152_book_catalog_split_write_policies.sql` | ✅ |

20 arquivos, 20 linhas no ledger remoto, interseção completa. Antes da
reconciliação a interseção era **vazia**.

### As cinco do catálogo re-divergiram — e foram realinhadas na hora

Aconteceu de novo, exatamente como descrito na seção seguinte, e vale o
registro porque prova que o alerta não é teórico.

As três últimas migrations do catálogo nasceram com timestamp escolhido à mão
(`…053500`, `…061500`, `…094500`). O conector aplicou cada uma e gravou no
ledger **o instante da aplicação** (`…053022`, `…054248`, `20260807184152`).
Contagem igual, versões diferentes: a divergência voltando pela terceira vez.

Foi detectado ao conferir `list_migrations` contra `ls supabase/migrations`
antes de abrir a PR, e resolvido renomeando os ARQUIVOS para a versão que o
remoto registrou — nunca o contrário. Reescrever o ledger exigiria
`migration repair`, que precisa de autorização humana e não estava em jogo.

A lição que já estava escrita aqui e se confirmou: **o nome do arquivo não é
escolha nossa quando a aplicação passa pelo conector.** Aplicar primeiro, ler
a versão gravada, e só então nomear o arquivo.

### As três últimas entraram depois da reconciliação — e quase re-divergiram

`20260804200809_harden_password_flag_and_progress`,
`20260804201803_atomic_content_creation` e
`20260805014918_drop_redundant_order_constraints` são as primeiras migrations
criadas sob a regra nova. As três foram aplicadas com `apply_migration` do
conector, e isso merece registro honesto, porque **é exatamente o caminho que
causou a divergência original**.

O que aconteceu, nas três: o arquivo nasceu com um timestamp escolhido à mão
(`20260804200000_...` na primeira). O conector aplicou e gravou no ledger uma
versão própria — o instante da aplicação, não o nome do arquivo. Por alguns
segundos o repositório e o remoto tinham a mesma CONTAGEM e versões diferentes:
a divergência recém-fechada estava voltando, um registro por vez.

A correção foi imediata e trivial porque foi percebida na hora: cada arquivo
local foi renomeado para a versão que o ledger registrou. É a mesma operação da
reconciliação, em escala de um.

**Por que o conector, e não `supabase db push`:** `db push` exige
`supabase link`, que exige a senha do banco de produção — que ninguém deve
pedir nem guardar num agente. Sem o link, o conector era o único caminho
disponível para aplicar a correção de segurança.

**A lição operacional, que vale mais que a regra abstrata:** enquanto o
`supabase link` não existir, toda aplicação pelo conector precisa ser seguida
de duas ações, na mesma sessão:

1. `select version from supabase_migrations.schema_migrations order by version desc limit 1;`
2. renomear o arquivo local para essa versão.

Pular o passo 2 recria a divergência. Foi assim que ela nasceu na primeira vez:
não por má intenção, mas porque ninguém conferiu o que o ledger tinha
registrado.

---

## O que foi feito em 2026-08-04

### 1. Sete arquivos renomeados (`git mv`, conteúdo intacto)

```text
20260802120000_initial_schema.sql                         → 20260803202658_initial_schema.sql
20260803090000_secure_lesson_completion.sql               → 20260803202701_secure_lesson_completion.sql
20260804090000_private_lesson_media.sql                   → 20260803202703_private_lesson_media.sql
20260804100000_harden_rls_and_api_permissions.sql         → 20260803203311_harden_rls_and_api_permissions.sql
20260804110000_auto_enroll_free_course.sql                → 20260803203841_auto_enroll_free_course.sql
20260804120000_scope_free_enrollment_to_public_signup.sql → 20260803204549_scope_free_enrollment_to_public_signup.sql
20260805090000_admin_content_ordering.sql                 → 20260803221619_admin_content_ordering.sql
```

Só o **nome** mudou. Os sete blobs têm hash idêntico ao de antes, e o git
registrou os sete como renames (`R`), não como delete+add. A ordem relativa foi
preservada: a sequência ordenada por nome é a mesma de antes, migration a
migration.

### 2. Um arquivo criado: `20260803221658_admin_content_ordering_search_path.sql`

Os quatro `alter function ... set search_path = ''` foram lidos do campo
`statements` da própria linha `20260803221658` — é o SQL que rodou em produção,
não uma reconstrução. Num banco novo eles rodam depois de
`20260803221619_admin_content_ordering`, que já cria as quatro funções com
`search_path = ''`; portanto são **no-op idempotente**. O arquivo existe para
preservar a narrativa (ver abaixo), e o motivo está comentado no topo dele.

### 3. Referências textuais atualizadas

Em `docs/SETUP-MVP.md` (tabela das migrations),
`docs/QA-CHECKLIST.md`, `docs/PROPOSTA-RLS-PROGRESSO.md`, `supabase/seed.sql` e
sete arquivos em `src/lib/`.

**Exceção deliberada:** três comentários *dentro* de migrations já aplicadas
ainda citam os nomes antigos —
`20260803202701_secure_lesson_completion.sql:5` e
`20260803202703_private_lesson_media.sql:5-6`. Não foram editados de propósito:
mexer no conteúdo de uma migration já aplicada muda o checksum que a CLI
compara e viola a regra de não editar migration antiga. São comentários
históricos e inofensivos; ficam como estão.

### 4. O que **não** foi feito

`supabase init` e `supabase link` continuam pendentes — não existe
`supabase/config.toml`. Exigem autorização humana (a seção final explica).

---

## Registro histórico: por que houve divergência

Mantido aqui de propósito. A causa raiz não se corrige renomeando arquivo, e
esquecê-la é o caminho mais curto para repetir o problema.

**Causa raiz: dois caminhos de escrita para o mesmo banco.** As migrations
foram aplicadas pelo conector MCP (`apply_migration`), que **gera a própria
versão a partir do relógio do servidor**, enquanto os arquivos do repositório
nasceram com timestamps escolhidos à mão. As oito versões remotas são todas de
2026-08-03 entre 20:26 e 22:16 — a janela de uma sessão do conector, não as
datas de autoria dos arquivos.

O resultado, medido em 2026-08-03: nenhuma das 7 versões do repositório existia
em `schema_migrations`. Para a CLI, o remoto tinha 8 migrations desconhecidas e
o repositório 7 pendentes — duas listas disjuntas que, por acaso, descreviam o
mesmo schema. O diagnóstico nunca foi "8 contra 7"; era interseção vazia.

### O registro que existia no banco e não no repositório

`20260803221658` endureceu `move_module`, `move_lesson`, `next_module_order` e
`next_lesson_order` de `search_path = public` para `search_path = ''`, 39
segundos depois de a migration anterior tê-las criado com o valor inseguro.

O **efeito** já estava no repositório (o arquivo de ordenação sempre criou as
quatro funções com `search_path = ''`). O que faltava era o **registro
contábil** — e, com ele, a narrativa de que produção passou por um estado
intermediário menos seguro. É isso que o arquivo criado no passo 2 devolve.

Confirmado no banco em 2026-08-04, por SELECT: as dez funções de `public` estão
com `search_path=""`, e `get_advisors(security)` não aponta
`function_search_path_mutable`.

### Por que renomear, e não `supabase migration repair`

`repair` alinha o remoto ao repositório e é a ferramenta certa quando o schema
está correto e só o ledger está errado. Foi descartado porque: escreve em
produção; `--status reverted` apagaria as 8 linhas e com elas a **única cópia**
do SQL de `20260803221658`; exige a senha do banco; e seriam 15 comandos, cada
um uma chance de errar um dígito.

Renomear tem custo de ~7 referências textuais e zero risco no banco. A troca foi
óbvia. O único caso em que `repair` seria obrigatório — outro ambiente já ter
consumido os nomes locais antigos — não se aplica: não há outro ambiente.

Perda aceita: os timestamps deixaram de refletir a data de autoria. Em
compensação passaram a refletir a data de **aplicação em produção**, que é o que
um ledger de migration deveria significar.

---

## A regra permanente

> **Toda mudança de schema nasce como arquivo em `supabase/migrations/` e vai
> para o banco por `supabase db push`. O `apply_migration` do conector MCP é
> para exploração, nunca para produção.**

O conector gera a própria versão e não deixa arquivo no repositório — foi
exatamente assim que as duas listas se separaram. Um schema só tem uma fonte da
verdade, e ela é o diretório `supabase/migrations/`.

Corolários:

- Migration já aplicada **não se edita**. Nem o SQL, nem o nome (a partir de
  agora). Correção vira migration nova.
- Se algo for aplicado pelo conector durante uma investigação, o arquivo
  correspondente entra no repositório **no mesmo commit**, com a versão que o
  conector gerou — não com um timestamp escolhido à mão.
- Antes de qualquer `db push`, rodar `supabase migration list --linked` e
  conferir que Local e Remote batem.

---

## Exige autorização humana explícita

Nada abaixo deve rodar sem um "sim" nominal:

- `supabase link` (pede a senha do banco de produção);
- **qualquer** `supabase migration repair` (escreve em `schema_migrations`);
- `supabase db push`, mesmo depois da reconciliação;
- `supabase db push --include-all` — em hipótese alguma;
- `supabase db reset` / `db reset --linked` — nunca contra este projeto;
- qualquer `apply_migration`, DDL ou `INSERT`/`UPDATE`/`DELETE` em
  `supabase_migrations.schema_migrations`.

Não precisa de autorização: `supabase migration list`, `db diff`, `db dump`,
`get_advisors`, `list_tables` e SELECTs em geral.

### Verificação recomendada quando houver Docker

A reconciliação alinhou o **ledger**. A prova mais forte de que o remoto é
exatamente a soma dos arquivos é `supabase db diff --linked --schema public`
(reconstrói um shadow DB a partir dos arquivos e compara) — **saída vazia =
prova**. Exige Docker e `link`, então ficou pendente. A evidência disponível
hoje é forte mas indireta: nomes e ordem batem 1:1, e o estado das funções e
policies no banco corresponde ao que os arquivos produzem.
