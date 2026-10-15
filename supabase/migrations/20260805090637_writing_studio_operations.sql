-- =============================================================================
-- BMaxy — operações atômicas do Estúdio de Escrita
-- =============================================================================
--
-- As funções permanecem SECURITY INVOKER: a RLS continua sendo a autoridade
-- sobre os manuscritos. A identidade nunca é recebida do cliente; vem de
-- auth.uid() dentro da transação.

create index if not exists writing_chapters_user_id_idx
  on public.writing_chapters (user_id);

create or replace function public.create_writing_project(
  p_project_title text,
  p_initial_chapter_title text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  insert into public.writing_projects (user_id, title)
  values (v_user_id, p_project_title)
  returning id into v_project_id;

  insert into public.writing_chapters (
    project_id,
    user_id,
    title,
    order_index
  ) values (
    v_project_id,
    v_user_id,
    p_initial_chapter_title,
    0
  );

  return v_project_id;
end;
$$;

create or replace function public.create_writing_chapter(
  p_project_id uuid,
  p_title text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order integer;
  v_chapter_id uuid;
  v_title text;
  v_locale text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.writing_projects p
    where p.id = p_project_id
      and p.user_id = v_user_id
  ) then
    raise exception 'Projeto não encontrado.' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('writing_chapters:' || p_project_id::text, 0)
  );

  select coalesce(max(c.order_index), -1) + 1
  into v_order
  from public.writing_chapters c
  where c.project_id = p_project_id
    and c.user_id = v_user_id;

  select p.locale
  into v_locale
  from public.profiles p
  where p.id = v_user_id;

  v_title := coalesce(
    nullif(btrim(p_title), ''),
    case when v_locale = 'en' then 'Chapter ' else 'Capítulo ' end || (v_order + 1)::text
  );

  insert into public.writing_chapters (
    project_id,
    user_id,
    title,
    order_index
  ) values (
    p_project_id,
    v_user_id,
    v_title,
    v_order
  )
  returning id into v_chapter_id;

  return v_chapter_id;
end;
$$;

create or replace function public.move_writing_chapter(
  p_chapter_id uuid,
  p_direction text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_order integer;
  v_neighbor_id uuid;
  v_neighbor_order integer;
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'Direção inválida.' using errcode = '22023';
  end if;

  select c.project_id
  into v_project_id
  from public.writing_chapters c
  where c.id = p_chapter_id
    and c.user_id = v_user_id;

  if v_project_id is null then
    raise exception 'Capítulo não encontrado.' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('writing_chapters:' || v_project_id::text, 0)
  );

  select c.order_index
  into v_order
  from public.writing_chapters c
  where c.id = p_chapter_id
    and c.project_id = v_project_id
    and c.user_id = v_user_id;

  if v_order is null then
    raise exception 'Capítulo não encontrado.' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select c.id, c.order_index
    into v_neighbor_id, v_neighbor_order
    from public.writing_chapters c
    where c.project_id = v_project_id
      and c.user_id = v_user_id
      and c.order_index < v_order
    order by c.order_index desc
    limit 1;
  else
    select c.id, c.order_index
    into v_neighbor_id, v_neighbor_order
    from public.writing_chapters c
    where c.project_id = v_project_id
      and c.user_id = v_user_id
      and c.order_index > v_order
    order by c.order_index asc
    limit 1;
  end if;

  if v_neighbor_id is null then
    return false;
  end if;

  update public.writing_chapters c
  set order_index = case c.id
    when p_chapter_id then v_neighbor_order
    when v_neighbor_id then v_order
  end
  where c.id in (p_chapter_id, v_neighbor_id)
    and c.project_id = v_project_id
    and c.user_id = v_user_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 2 then
    raise exception 'Não foi possível reordenar os capítulos.' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

revoke all on function public.create_writing_project(text, text)
  from public, anon;
revoke all on function public.create_writing_chapter(uuid, text)
  from public, anon;
revoke all on function public.move_writing_chapter(uuid, text)
  from public, anon;

grant execute on function public.create_writing_project(text, text)
  to authenticated;
grant execute on function public.create_writing_chapter(uuid, text)
  to authenticated;
grant execute on function public.move_writing_chapter(uuid, text)
  to authenticated;
