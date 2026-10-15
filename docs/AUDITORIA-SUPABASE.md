# Auditoria de Supabase — RLS, grants, funções e IDOR

Rodada de 2026-08-05, **somente leitura**. Nenhum dado de usuário foi alterado,
nenhuma migration aplicada, nenhum DDL executado.

É a quarta passada de segurança neste projeto. O valor aqui está no que
sobrou, não em repetir o que já foi resolvido.

---

## Resumo

| Área | Situação |
| --- | --- |
| RLS habilitada | **8/8 tabelas.** Nenhuma sem RLS. |
| Grants para `anon` | **Nenhum.** Nem tabela, nem função. |
| `search_path` das funções | **12/12 com `search_path=""`.** |
| `lesson_media` | **0 policies**, inacessível por SELECT comum. |
| Colunas graváveis em `profiles` | Só `full_name` e `locale`. |
| Achado novo | **Nenhum explorável.** Dois itens conhecidos seguem abertos. |

---

## 1. Funções `SECURITY DEFINER`

Cinco funções definer são executáveis por `authenticated` — é o que o advisor
reporta como WARN. Todas foram lidas e todas verificam autorização **antes** de
tocar em dado:

| Função | O que checa primeiro |
| --- | --- |
| `is_admin()` | Lê `user_roles` pelo `auth.uid()`. Não aceita parâmetro — não há o que forjar. |
| `complete_lesson(p_lesson_id)` | `auth.uid()`, matrícula ativa, curso e aula publicados, e **todas as aulas anteriores concluídas**. |
| `get_lesson_playback(p_lesson_id)` | Mesma cadeia. É a única porta pela qual o `video_id` sai do banco. |
| `move_lesson` / `move_module` | `is_admin()` na primeira instrução, com `raise exception` se falhar. |

O ponto que torna isso seguro contra IDOR: **a identidade nunca vem por
parâmetro.** As funções recebem o id do *recurso* (`p_lesson_id`), nunca o id
do *usuário* — este sai sempre de `auth.uid()`. Passar o uuid de outra pessoa
não é possível porque não há onde passá-lo.

`create_module` e `create_lesson` são `SECURITY INVOKER` desde a migration
`20260804201803` — as policies `*_insert_admin` é que autorizam. Por isso não
aparecem no advisor.

**Veredito:** os 5 WARN são esperados e corretos. Revogar o `EXECUTE` quebraria
o produto; são exatamente as funções que o aluno e o admin precisam chamar.

---

## 2. IDOR — onde o id vem do cliente

Todo ponto em que um identificador chega do navegador, e o que impede o uso de
um id alheio:

| Origem | Id | O que protege |
| --- | --- | --- |
| `/aluno/curso/[slug]` | slug do curso | RLS (`status='published'` + matrícula ativa) **e** `requireStudent()` na DAL |
| `/aluno/aula/[lessonId]` | uuid da aula | RLS + `get_lesson_playback()` valida a cadeia inteira |
| `markLessonCompleteAction` | uuid da aula | `requireStudent()` + `complete_lesson()`, que ignora qualquer noção de usuário vinda de fora |
| `/admin/alunos/[id]` | uuid do aluno | `requireAdmin()` no layout **e** na DAL |
| Server Actions do painel | uuids vários | `requireAdmin()` na primeira instrução das 19 actions + policies `is_admin()` |
| RPCs de ordenação | uuid do módulo/aula | `is_admin()` dentro da função |

**Duas camadas em todos os casos**: aplicação e banco. Nenhum ponto depende só
de uma. Não encontrei caminho em que o id do cliente selecione dado de outra
pessoa.

Detalhe já corrigido em rodada anterior e reconferido: as consultas de
`lesson_progress` na DAL do aluno filtram por `.eq("user_id", auth.userId)`
explicitamente. Sem isso, um admin receberia o progresso de todo mundo, porque
a policy de SELECT é `user_id = auth.uid() OR is_admin()`.

---

## 3. `lesson_media` — três camadas

1. **Coluna removida**: `lessons.video_id` não existe mais. Uma consulta antiga
   falha com `42703`.
2. **Tabela sem policy**: RLS ligada, zero policies. Para `authenticated`, isso
   é negar tudo.
3. **Única saída**: `get_lesson_playback()`, definer, que valida antes de
   devolver.

Verificado que nenhuma view, coluna gerada ou função alternativa reexpõe o
valor. O advisor marca `rls_enabled_no_policy` como INFO — é intencional e
deve continuar assim.

---

## 4. O que continua aberto

### 4.1 Grants de coluna em `lesson_progress` — BAIXO

`authenticated` tem UPDATE/INSERT nas colunas `completed`, `user_id`,
`percent_complete` e afins. Quem barra é o `WITH CHECK` das policies, que exige
`user_id = auth.uid() AND completed = false`.

Funciona hoje. O risco é de *manutenção*: um `drop policy` numa migration
futura reabre a escrita direta de `completed = true` sem nenhuma segunda
barreira. O `revoke` de coluna daria defesa em profundidade, como já foi feito
em `profiles.must_change_password`.

**Não explorável hoje.** SQL proposto na seção 6.

### 4.2 Admin pode reatribuir linha de progresso — BAIXO

`UPDATE lesson_progress SET user_id = <admin>, completed = false WHERE user_id
= <aluno>` passa no `USING` (que tem `is_admin()`) e no `WITH CHECK` (porque o
novo `user_id` é o do próprio admin). Efeito prático: apaga o progresso do
aluno.

**Não é escalada** — o admin já tem `DELETE` nessa tabela por desenho. É
anomalia de integridade, não de segurança.

### 4.3 Proteção contra senhas vazadas — **desativada**

Ver a seção 5.

---

## 5. Senha vazada: por que não ativei, e o caminho exato

**Não é possível ativar pelas ferramentas disponíveis.** O conector MCP do
Supabase expõe `apply_migration`, `execute_sql`, `get_advisors`, `list_*` e
afins — todas operam sobre o **banco**. A proteção contra senhas vazadas é
configuração do **serviço de Auth (GoTrue)**, não schema: não existe tabela
para alterar nem SQL que a ligue. Tentar contornar por SQL seria mexer no
schema `auth`, que é gerenciado pelo Supabase — exatamente o tipo de atalho que
quebra numa atualização do provedor.

### Caminho manual

1. <https://supabase.com/dashboard> → projeto **BMaxy** (`qlrljzodmisvohjeodxt`)
2. **Authentication** → **Policies**
   *(dependendo da versão da interface, aparece como
   **Sign In / Providers** → **Password**)*
3. Seção **Password protection**
4. Ligar **"Prevent use of leaked passwords"** e salvar

Documentação:
<https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>

Depois de ligar, rode o advisor de novo: o aviso
`auth_leaked_password_protection` deve sumir.

**Enquanto estiver desligado**, o único obstáculo a uma senha conhecidamente
vazada é o mínimo de 8 caracteres do Zod em `src/lib/validation/auth.ts`. Isso
vale para o cadastro público e para a redefinição de senha.

---

## 6. SQL proposto — NÃO aplicado

Para uma migration futura, se e quando a defesa em profundidade do item 4.1 for
priorizada:

```sql
-- Tira do aluno a capacidade de escrever as colunas que decidem progresso.
-- A policy já barra; isto é a segunda barreira, para o dia em que alguém
-- editar a policy sem perceber o que ela sustentava.
revoke update (completed, user_id, percent_complete, watched_seconds)
  on public.lesson_progress from authenticated;
revoke insert (completed, user_id)
  on public.lesson_progress from authenticated;
```

**Verificar antes de aplicar:** `complete_lesson()` é `SECURITY DEFINER` e roda
como dona do objeto, então continua escrevendo normalmente. O que precisa ser
testado é o caminho de *criação* da linha de progresso pelo aluno (o INSERT com
`completed = false`), que hoje passa pelo cliente autenticado.

---

## 7. Advisors

| Nível | Item | Situação |
| --- | --- | --- |
| INFO | `lesson_media` com RLS e sem policy | **Intencional.** É o mecanismo de negar tudo. |
| WARN × 5 | Funções definer executáveis por `authenticated` | **Esperado.** Todas guardadas — seção 1. |
| WARN | `auth_leaked_password_protection` desativada | **Aberto.** Exige painel — seção 5. |

Performance: sem achados.

**Nada piorou nesta rodada.** As duas funções criadas na rodada anterior
(`create_module`, `create_lesson`) são `SECURITY INVOKER` e por isso não
acrescentaram advisor novo.
