-- =============================================================================
--  BMaxy — reordenar módulos e aulas sem quebrar a unicidade
-- =============================================================================
--
--  MIGRATION INCREMENTAL. Nenhuma migration anterior é editada.
--
--  O PROBLEMA
--  ----------
--  `course_modules` tem `unique (course_id, order_index)` e `lessons` tem
--  `unique (module_id, order_index)`. Isso é o certo — sem elas, duas aulas
--  poderiam ocupar a mesma posição e a sequência de desbloqueio ficaria
--  ambígua. Mas torna "trocar A com B" impossível em um passo: qualquer
--  UPDATE que ponha A na posição de B colide com B antes de B sair de lá.
--
--  Fazer isso do lado da aplicação exigiria três chamadas seguidas (A → -1,
--  B → posição de A, A → posição de B) sem transação. Se a segunda falhasse,
--  um módulo ficaria parado em -1 e a ordem do curso quebraria em produção.
--
--  A SOLUÇÃO
--  ---------
--  Duas funções que fazem a troca DENTRO de uma transação só. O passo pelo
--  sentinela -1 continua existindo, mas agora é atômico: ou os três UPDATEs
--  acontecem, ou nenhum.
--
--  SEGURANÇA
--  ---------
--  `security definer` com `search_path = ''` (vazio, como as funções que já
--  existem no projeto — obriga a qualificar tudo com `public.`, e é por isso
--  que não há um único nome solto no corpo delas), e a PRIMEIRA coisa que fazem é
--  checar `is_admin()`. Sem essa checagem, security definer transformaria as
--  funções em uma porta para qualquer aluno reordenar o curso. EXECUTE é
--  concedido só a `authenticated` — nunca a `anon`.
--
--  Elas devolvem boolean: `false` quando não há vizinho na direção pedida
--  (já é o primeiro/último). Isso não é erro, é o fim da lista.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Módulos
-- -----------------------------------------------------------------------------
create or replace function public.move_module(p_module_id uuid, p_direction text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
  v_order integer;
  v_neighbor_id uuid;
  v_neighbor_order integer;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem reordenar módulos.' using errcode = '42501';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'Direção inválida.' using errcode = '22023';
  end if;

  select m.course_id, m.order_index into v_course_id, v_order
  from public.course_modules m where m.id = p_module_id;

  if v_course_id is null then
    raise exception 'Módulo não encontrado.' using errcode = 'P0002';
  end if;

  -- O vizinho imediato na direção pedida. `order by` + `limit 1` em vez de
  -- `order_index ± 1` porque a numeração pode ter buracos (uma exclusão no
  -- meio deixa 0, 1, 3) e ± 1 simplesmente não acharia ninguém.
  if p_direction = 'up' then
    select m.id, m.order_index into v_neighbor_id, v_neighbor_order
    from public.course_modules m
    where m.course_id = v_course_id and m.order_index < v_order
    order by m.order_index desc
    limit 1;
  else
    select m.id, m.order_index into v_neighbor_id, v_neighbor_order
    from public.course_modules m
    where m.course_id = v_course_id and m.order_index > v_order
    order by m.order_index asc
    limit 1;
  end if;

  if v_neighbor_id is null then
    return false;
  end if;

  -- Troca em três passos por causa do unique (course_id, order_index). Os três
  -- rodam na mesma transação: ou tudo, ou nada.
  update public.course_modules set order_index = -1, updated_at = now()
  where id = p_module_id;

  update public.course_modules set order_index = v_order, updated_at = now()
  where id = v_neighbor_id;

  update public.course_modules set order_index = v_neighbor_order, updated_at = now()
  where id = p_module_id;

  return true;
end;
$$;

revoke all on function public.move_module(uuid, text) from public, anon;
grant execute on function public.move_module(uuid, text) to authenticated;

comment on function public.move_module(uuid, text) is
  'Troca um módulo de posição com o vizinho imediato, atomicamente. Só admin. '
  'Devolve false quando já é o primeiro (up) ou o último (down).';

-- -----------------------------------------------------------------------------
-- Aulas
-- -----------------------------------------------------------------------------
create or replace function public.move_lesson(p_lesson_id uuid, p_direction text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_module_id uuid;
  v_order integer;
  v_neighbor_id uuid;
  v_neighbor_order integer;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem reordenar aulas.' using errcode = '42501';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'Direção inválida.' using errcode = '22023';
  end if;

  select l.module_id, l.order_index into v_module_id, v_order
  from public.lessons l where l.id = p_lesson_id;

  if v_module_id is null then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  -- A troca acontece DENTRO do módulo. Mover uma aula para outro módulo é
  -- outra operação (e outro botão): arrastar a última aula do módulo 1 para o
  -- topo do módulo 2 mudaria a sequência de desbloqueio de forma que o
  -- administrador não pediu.
  if p_direction = 'up' then
    select l.id, l.order_index into v_neighbor_id, v_neighbor_order
    from public.lessons l
    where l.module_id = v_module_id and l.order_index < v_order
    order by l.order_index desc
    limit 1;
  else
    select l.id, l.order_index into v_neighbor_id, v_neighbor_order
    from public.lessons l
    where l.module_id = v_module_id and l.order_index > v_order
    order by l.order_index asc
    limit 1;
  end if;

  if v_neighbor_id is null then
    return false;
  end if;

  update public.lessons set order_index = -1, updated_at = now()
  where id = p_lesson_id;

  update public.lessons set order_index = v_order, updated_at = now()
  where id = v_neighbor_id;

  update public.lessons set order_index = v_neighbor_order, updated_at = now()
  where id = p_lesson_id;

  return true;
end;
$$;

revoke all on function public.move_lesson(uuid, text) from public, anon;
grant execute on function public.move_lesson(uuid, text) to authenticated;

comment on function public.move_lesson(uuid, text) is
  'Troca uma aula de posição com a vizinha imediata dentro do mesmo módulo, '
  'atomicamente. Só admin. Devolve false quando já é a primeira ou a última.';

-- -----------------------------------------------------------------------------
-- Próxima posição livre — evita corrida ao criar
-- -----------------------------------------------------------------------------
-- Sem isto, criar dois módulos em sequência exigiria ler o maior order_index
-- na aplicação e somar 1 — duas abas abertas gerariam o mesmo número e a
-- segunda criação estouraria a constraint com um erro incompreensível.
-- Estas duas ficam DE PROPÓSITO sem `security definer`: elas não precisam
-- contornar RLS. Rodando como invoker, a policy de SELECT já vale — um admin
-- enxerga tudo, e um aluno só enxergaria o que já pode ver de qualquer forma.
-- Com `security definer` elas virariam um vazamento bobo: qualquer
-- authenticated descobriria quantos módulos um curso em rascunho tem.
create or replace function public.next_module_order(p_course_id uuid)
returns integer
language sql
set search_path = ''
stable
as $$
  select coalesce(max(order_index), -1) + 1
  from public.course_modules
  where course_id = p_course_id;
$$;

create or replace function public.next_lesson_order(p_module_id uuid)
returns integer
language sql
set search_path = ''
stable
as $$
  select coalesce(max(order_index), -1) + 1
  from public.lessons
  where module_id = p_module_id;
$$;

revoke all on function public.next_module_order(uuid) from public, anon;
revoke all on function public.next_lesson_order(uuid) from public, anon;
grant execute on function public.next_module_order(uuid) to authenticated;
grant execute on function public.next_lesson_order(uuid) to authenticated;
