# Proposta: arquivar cursos em vez de apagá-los

**Nada disto foi implementado.** É uma proposta com o SQL esboçado, para
decisão. Investigado em 2026-08-03, somente leitura.

---

## O que existe hoje, verificado

O painel **não** tem `deleteCourseAction` — as ações de exclusão em
`src/lib/actions/admin.ts` são só `deleteModuleAction` e `deleteLessonAction`.
Mas a capacidade existe no banco: a policy `courses_delete_admin`
(`DELETE ... using is_admin()`) está ativa, então qualquer admin com um token
válido apaga um curso direto pelo PostgREST. A exclusão de curso está a uma
linha de código de distância.

As cascatas, confirmadas em `pg_constraint`:

```
course_modules.course_id  → courses(id)         ON DELETE CASCADE
lessons.module_id         → course_modules(id)  ON DELETE CASCADE
lesson_media.lesson_id    → lessons(id)         ON DELETE CASCADE
lesson_progress.lesson_id → lessons(id)         ON DELETE CASCADE
enrollments.course_id     → courses(id)         ON DELETE CASCADE
```

Um `delete from courses` derruba os cinco níveis. Sem `deleted_at`, sem log, sem
volta — inclusive o progresso de todos os alunos.

Dois buracos menores no caminho:

- `deleteModuleAction` recusa módulo com aulas, mas a guarda vive **em
  TypeScript** (`admin.ts`), então não protege quem chama o PostgREST direto.
- `deleteLessonAction` **não tem guarda nenhuma** e apaga `lesson_media` +
  `lesson_progress` em cascata, silenciosamente. É o mais agudo hoje.

---

## Proposta: `'archived'` como terceiro valor de `courses.status`

Não uma tabela separada, não um boolean.

**Por que não tabela separada:** mover a linha quebraria as cinco FKs. Ou se
derruba as constraints (perde integridade) ou a própria mudança dispara a
cascata que se queria evitar.

**Por que não um boolean `is_archived`:** criaria duas fontes de verdade. Toda
policy precisaria de `status = 'published' AND is_archived = false`, e basta uma
esquecer a segunda metade para vazar.

**Por que `status` funciona bem aqui:** as policies existentes são *allowlist*
(`status = 'published'`), não denylist. Um valor novo é excluído por construção.
Isso é herança de um design anterior bem feito, e vale explorar.

### O impacto é: nada é apagado

- **`enrollments`** — linhas ficam, `status = 'active'` intacto. Não virar
  `'revoked'`: revogar é decisão sobre a *pessoa*, arquivar é sobre o *curso*.
- **`lesson_progress`** — intacto, 100%. É o ativo mais caro do sistema: o tempo
  dos alunos.
- **`course_modules` / `lessons` / `lesson_media`** — intactos.

### RLS: quase nada muda — e é por isso que a abordagem é a certa

Das 22 policies, **nenhuma precisa mudar**. O curso some para o aluno
(`status = 'published'` nas policies de leitura e nas de escrita de progresso) e
continua visível para o admin (`is_admin()`).

Duas ressalvas reais:

1. **`handle_new_user()` não olha status.** O trigger matricula todo cadastro
   público em `seu-livro` sem filtrar. Se o curso gratuito for arquivado, todo
   novo cadastro ganha matrícula num curso invisível. **Precisa ser corrigido na
   mesma migration.**
2. **`enrollments` continua visível ao aluno.** Não aparece na UI hoje, mas se
   alguém criar uma tela de matrículas precisa usar *inner join* em `courses`,
   senão nasce um card fantasma sem título.

O trabalho de verdade fica na aplicação: `z.enum(["draft","published"])` em
`src/lib/validation/admin.ts` e os tipos em `src/lib/dal/admin.ts` precisam de
`"archived"`.

### Quem estava no meio do curso

Perde o acesso **imediatamente**, mas **mantém tudo o que já concluiu**. Se o
curso for desarquivado e republicado, volta exatamente de onde parou.

`unarchive` devolve o curso para **`draft`, sempre**. Republicar vira ato
deliberado — o modo de falha "desarquivei pra olhar e o curso reapareceu pros
alunos" não existe.

Duas mitigações que valem como parte da feature:

- **Aviso no arquivamento** com quantas matrículas ativas e quantos alunos com
  progresso serão afetados. Arquivar curso com 200 alunos não pode ter a mesma
  fricção que arquivar um rascunho.
- **Considerar um status `'retired'` separado** — "não aceita aluno novo, mas
  quem já entrou termina". É decisão de **produto**, não de engenharia, e muda o
  desenho: `'retired'` entraria no allowlist das quatro policies de leitura e
  das duas de escrita de progresso. Decidir **antes** de escrever a migration.

### A exclusão destrutiva deve continuar existindo?

Sim, mas só onde não há rastro humano — e **a guarda tem que estar no banco**,
via trigger `BEFORE DELETE`, não na UI:

| Objeto | Pode excluir de verdade quando | Senão |
| --- | --- | --- |
| Curso | zero `enrollments` (qualquer status) **e** zero `lesson_progress` | arquivar |
| Módulo | zero aulas (regra atual, movida para o banco) | esvaziar antes |
| Aula | zero `lesson_progress` | `status = 'draft'` já a esconde |

O critério do curso é "qualquer status", não "ativa": um curso com uma matrícula
revogada é fato histórico — pode ser preciso provar que fulano teve acesso. Um
curso que ninguém nunca tocou é erro de digitação, e obrigar a arquivar erro de
digitação entope o painel.

---

## Esboço da migration (NÃO aplicada)

```sql
-- 1) status ganha 'archived'
alter table public.courses drop constraint if exists courses_status_check;
alter table public.courses add constraint courses_status_check
  check (status in ('draft', 'published', 'archived'));

-- 2) auditoria. NÃO filtram nada: quem filtra é status, e só ele.
alter table public.courses
  add column if not exists archived_at     timestamptz,
  add column if not exists archived_by     uuid references auth.users(id),
  add column if not exists archived_reason text;

alter table public.courses add constraint courses_archived_consistency
  check ((status = 'archived') = (archived_at is not null));

-- 3) archive_course / unarchive_course como RPC security definer,
--    search_path = '', is_admin() na primeira linha, EXECUTE só para
--    authenticated — mesmo padrão de move_module().
--    unarchive volta SEMPRE para 'draft'.

-- 4) handle_new_user() ganha `and c.status = 'published'` na matrícula
--    automática, senão cadastro novo entra em curso arquivado.

-- 5) triggers BEFORE DELETE em courses e lessons, recusando quando há
--    matrícula ou progresso. Vale para a UI, o PostgREST e o SQL editor.
```

O SQL completo está no relatório da auditoria; foi omitido aqui porque a decisão
de produto sobre `'retired'` muda o desenho das policies.
