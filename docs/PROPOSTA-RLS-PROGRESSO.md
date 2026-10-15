# Proposta: fechar duas brechas de escrita na RLS

**Nada disto foi aplicado.** É o SQL esboçado para decisão, na mesma linha de
[PROPOSTA-ARQUIVAR-CURSOS.md](PROPOSTA-ARQUIVAR-CURSOS.md). Levantado pela
revisão de segurança independente em 2026-08-04, confirmado por leitura de
`pg_policies` e `information_schema.column_privileges`.

Ficou fora da rodada de correção porque a tarefa era a separação
administrador/aluno, e mudança de banco pede migration incremental nova — e
autorização explícita para aplicar.

---

## 1. Administrador escreve progresso de qualquer aluno

`20260803203311_harden_rls_and_api_permissions.sql`, policies
`lesson_progress_insert_authorized` e `lesson_progress_update_authorized`. As
duas começam o `WITH CHECK` com:

```sql
(select public.is_admin()) or ( ...regras do aluno... )
```

e `authenticated` tem INSERT/UPDATE em nível de tabela e em todas as colunas,
`user_id` e `completed` incluídos.

**O que dá para fazer:** com uma sessão de administrador,

```http
POST /rest/v1/lesson_progress
{"user_id": "<uuid de um aluno>", "lesson_id": "<qualquer>", "completed": true}
```

é aceito. Isso passa por cima de tudo que `complete_lesson()` valida —
matrícula ativa, aula publicada, ordem sequencial — e contradiz o invariante
declarado de que aquela função é o único caminho para `completed = true`.

**Explorabilidade: limitada, e vale dizer por quê.** Quem tem sessão de
administrador é o operador, que também tem a `SUPABASE_SECRET_KEY` — e com ela
ignora RLS inteira de qualquer jeito. O ganho real é contra uma sessão de admin
roubada (XSS, máquina emprestada): hoje ela forja conclusão de curso sem
precisar da chave secreta. É defesa em profundidade, não fronteira de
privilégio quebrada.

**Correção proposta:** tirar `is_admin()` do `WITH CHECK` das duas policies. O
administrador continua LENDO todo o progresso (o `USING` não muda, e as telas
do painel dependem disso); só deixa de poder escrever progresso alheio pela
API. Se um dia o painel precisar zerar progresso de alguém, isso vira uma RPC
`security definer` com `is_admin()` na primeira linha e registro de quem fez —
que é auditável, ao contrário de um INSERT solto.

## 2. Aluno remove a própria obrigação de trocar a senha

Mesma migration, linha 24:

```sql
grant update (full_name, locale, must_change_password) on public.profiles to authenticated;
```

combinado com a policy `profiles_update_authorized` (`id = auth.uid()`).

**O que dá para fazer:** o administrador cria a conta com senha temporária; o
aluno faz `PATCH /rest/v1/profiles?id=eq.<ele mesmo>` com
`{"must_change_password": false}` e fica para sempre com a senha que o
administrador conhece.

**Metade já foi corrigida nesta rodada.** A versão simples do furo nem exigia
REST: `must_change_password` só era checado dentro de `loginAction`, então
bastava navegar direto para `/aluno` para nunca mais ser perguntado. Agora a
checagem está em `requireUser()` (`src/lib/auth/session.ts`), que é a base de
toda rota protegida — a flag passou a valer em cada navegação.

Falta a metade do banco: enquanto o aluno puder escrever a coluna, ele apaga a
flag e a checagem nova para de disparar.

**Correção proposta:** tirar `must_change_password` do grant de coluna.

```sql
revoke update (must_change_password) on public.profiles from authenticated;
```

Quem precisa escrever essa coluna são `createStudentAction` e
`resetPasswordAction`, ambos no servidor. O primeiro usa o cliente
administrativo; o segundo escreve como o próprio usuário e **passaria a
falhar** — então a migration precisa, no mesmo arquivo, mover essa escrita para
dentro de uma função `security definer` (ou para o cliente administrativo).
Aplicar o `revoke` sozinho quebra a redefinição de senha.

**Impacto:** nenhum sobre dados existentes. Só sobre quem pode escrever a
coluna.

---

## Ordem sugerida

O item 2 é mais barato e tem impacto mais direto (senha temporária é um
segredo compartilhado com o operador). O item 1 é mais invasivo, porque exige
decidir antes se o painel vai precisar mesmo de escrita administrativa de
progresso — se for precisar, a RPC tem que nascer junto, senão a funcionalidade
some sem aviso.

As duas cabem numa única migration incremental nova. Nenhuma exige tocar em
migration antiga.
