-- =============================================================================
--  BMaxy — fixar search_path das funções de ordenação de conteúdo
-- =============================================================================
--
--  POR QUE ESTE ARQUIVO EXISTE
--  ---------------------------
--  Este arquivo não introduz nenhuma mudança de schema. Ele existe para
--  preservar a NARRATIVA: produção passou por um estado intermediário menos
--  seguro, e o repositório precisa contar isso.
--
--  O que aconteceu: `20260803221619_admin_content_ordering` foi aplicada em
--  produção criando `move_module()`, `move_lesson()`, `next_module_order()` e
--  `next_lesson_order()` com `search_path = public`. Trinta e nove segundos
--  depois, esta correção endureceu as quatro para `search_path = ''`, fechando
--  o alerta `function_search_path_mutable` do Supabase advisor. Com
--  `search_path` mutável, uma função `security definer` pode ser induzida a
--  resolver um nome não qualificado para um objeto plantado por um atacante em
--  outro schema.
--
--  O conteúdo abaixo foi lido do campo `statements` da linha
--  `20260803221658` em `supabase_migrations.schema_migrations` — é
--  literalmente o SQL que rodou em produção, não uma reconstrução de memória.
--
--  POR QUE É UM NO-OP IDEMPOTENTE EM UM BANCO NOVO
--  -----------------------------------------------
--  O arquivo anterior nesta sequência, `20260803221619_admin_content_ordering`,
--  já cria as quatro funções com `set search_path = ''` no próprio
--  `create or replace function` (o repositório sempre teve a versão corrigida;
--  o que faltava era o registro da correção). Num banco novo, portanto, estes
--  quatro `alter function` rodam DEPOIS de um arquivo que já deixou o
--  `search_path` no valor final e não mudam nada — reaplicam o valor que já
--  está lá.
--
--  Ou seja: em produção esta migration foi uma correção real; num banco novo é
--  um no-op. Nos dois casos o estado final é o mesmo, que é exatamente o que se
--  espera de uma migration idempotente.
--
--  NÃO REMOVA ESTE ARQUIVO. Sem ele, o repositório teria 7 migrations e o
--  remoto 8, e a divergência de ledger que este commit reconciliou voltaria a
--  existir. Ver docs/MIGRATIONS.md.
--
-- =============================================================================

alter function public.move_module(uuid, text) set search_path = '';
alter function public.move_lesson(uuid, text) set search_path = '';
alter function public.next_module_order(uuid) set search_path = '';
alter function public.next_lesson_order(uuid) set search_path = '';
