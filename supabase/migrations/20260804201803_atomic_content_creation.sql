-- =============================================================================
--  BMaxy — criação de conteúdo atômica, com a RLS continuando no comando
-- =============================================================================
--
--  Ajuste de `create_module()` e `create_lesson()`, introduzidas na migration
--  anterior (`20260804200809_harden_password_flag_and_progress`). O
--  comportamento visível não muda: continuam calculando a posição dentro do
--  mesmo comando que grava a linha, e continuam recusando quem não é
--  administrador. O que muda é COMO.
--
--  1. `security definer` -> `security invoker`
--  -------------------------------------------
--  A versão anterior rodava como dona do objeto e, portanto, IGNORAVA a RLS.
--  A autorização estava correta (`is_admin()` na primeira linha), mas o
--  desenho era pior do que precisava ser: as policies `course_modules_insert_admin`
--  e `lessons_insert_admin` (`with check is_admin()`) já existem e já dizem
--  exatamente a mesma coisa. Rodar como definer significava mantê-las de
--  enfeite — e, no dia em que alguém as apertasse (por exemplo, "o admin só
--  edita curso que ele criou"), a função continuaria passando por cima sem
--  ninguém perceber.
--
--  Com `security invoker` a policy volta a ser quem decide. O `is_admin()`
--  explícito continua na primeira linha, agora como mensagem de erro decente
--  em vez de um "violates row-level security policy" cru.
--
--  Efeito colateral bem-vindo: some o alerta
--  `authenticated_security_definer_function_executable` do advisor para estas
--  duas funções.
--
--  2. Lock de linha do pai -> advisory lock de transação
--  -----------------------------------------------------
--  A versão anterior fazia `select ... from public.courses ... for update`
--  para serializar criações concorrentes no mesmo curso. Funciona, mas:
--
--    - `select for update` exige privilégio de UPDATE na tabela travada, o que
--      amarra a função a um grant que nada tem a ver com criar módulo;
--    - trava a linha do CURSO, então renomear o curso e criar um módulo nele
--      passam a esperar um pelo outro sem motivo.
--
--  `pg_advisory_xact_lock` não toca em linha nenhuma: é um número que só estas
--  funções conhecem. Serializa exatamente o que precisa ser serializado —
--  criações no mesmo pai — e some sozinho no fim da transação, inclusive se ela
--  falhar.
--
--  As chaves têm prefixo diferente ('course_modules:' e 'lessons:') porque o
--  espaço de advisory lock é global no banco: sem o prefixo, um module_id e um
--  course_id com o mesmo hash se bloqueariam à toa.
--
--  POR QUE O LOCK É NECESSÁRIO mesmo com o INSERT ... SELECT num comando só:
--  em READ COMMITTED duas transações concorrentes não enxergam a linha ainda
--  não commitada uma da outra. As duas leem o mesmo `max(order_index)`, as duas
--  calculam a mesma posição, e uma leva 23505. O comando único estreita a
--  janela; só o lock a fecha.
--
--  As constraints unique continuam: o lock evita a colisão, a constraint é a
--  garantia de que ela não acontece por outro caminho.
--
-- =============================================================================

create or replace function public.create_module(
  p_course_id uuid,
  p_title_pt text,
  p_title_en text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_novo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem criar módulos.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.courses c where c.id = p_course_id) then
    raise exception 'Curso não encontrado.' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('course_modules:' || p_course_id::text, 0)
  );

  insert into public.course_modules (course_id, title_pt, title_en, order_index)
  select p_course_id, p_title_pt, p_title_en,
         coalesce(max(m.order_index), -1) + 1
  from public.course_modules m
  where m.course_id = p_course_id
  returning id into v_novo_id;

  return v_novo_id;
end;
$$;

--  A aula nasce SEMPRE como rascunho, sem vídeo e sem duração. Publicar é ato
--  deliberado, feito depois pela tela de edição: uma aula publicada no instante
--  da criação entraria na sequência do aluno sem título revisado e sem vídeo.
--  Por isso `status` não é parâmetro — não é dado de entrada, é regra.

create or replace function public.create_lesson(
  p_module_id uuid,
  p_title_pt text,
  p_title_en text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_novo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem criar aulas.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.course_modules m where m.id = p_module_id) then
    raise exception 'Módulo não encontrado.' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lessons:' || p_module_id::text, 0)
  );

  insert into public.lessons (module_id, title_pt, title_en, status, order_index)
  select p_module_id, p_title_pt, p_title_en, 'draft',
         coalesce(max(l.order_index), -1) + 1
  from public.lessons l
  where l.module_id = p_module_id
  returning id into v_novo_id;

  return v_novo_id;
end;
$$;

revoke all on function public.create_module(uuid, text, text) from public, anon;
revoke all on function public.create_lesson(uuid, text, text) from public, anon;
grant execute on function public.create_module(uuid, text, text) to authenticated;
grant execute on function public.create_lesson(uuid, text, text) to authenticated;

--  `move_module()` e `move_lesson()` sofrem da MESMA classe de corrida: as duas
--  estacionam um registro em order_index = -1 durante a troca de três passos.
--  Dois movimentos simultâneos no mesmo pai disputariam esse sentinela e um
--  levaria 23505 sem necessidade. O mesmo advisory lock, com a mesma chave,
--  põe os dois em fila. É acrescentar uma linha a funções que já existem — o
--  corpo não muda em mais nada.

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

  -- Mesma chave de create_module: criar e mover no mesmo curso não se
  -- atropelam, e nada trava entre cursos diferentes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('course_modules:' || v_course_id::text, 0)
  );

  -- Reler a posição DEPOIS do lock: se outra transação moveu este módulo
  -- enquanto esperávamos, o valor lido antes já não vale.
  select m.order_index into v_order
  from public.course_modules m where m.id = p_module_id;

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

  update public.course_modules set order_index = -1, updated_at = now()
  where id = p_module_id;

  update public.course_modules set order_index = v_order, updated_at = now()
  where id = v_neighbor_id;

  update public.course_modules set order_index = v_neighbor_order, updated_at = now()
  where id = p_module_id;

  return true;
end;
$$;

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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lessons:' || v_module_id::text, 0)
  );

  select l.order_index into v_order
  from public.lessons l where l.id = p_lesson_id;

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
