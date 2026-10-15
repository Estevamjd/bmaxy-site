-- =============================================================================
-- Segurança de progresso: impede o cliente de gravar completed=true direto
-- na tabela e centraliza a conclusão de aula numa função validada no banco.
--
-- Migration incremental (não edita 20260802120000_initial_schema.sql, que já
-- pode ter sido aplicada em algum ambiente).
--
-- PROBLEMA que esta migration fecha: as policies originais de
-- lesson_progress (insert_own/update_own) já exigiam matrícula ativa e aula
-- coming_soon/published, mas não impediam o PRÓPRIO CLIENTE de fazer
--   update lesson_progress set completed = true, percent_complete = 100
--   where lesson_id = '<qualquer aula acessível>'
-- direto, sem checar vídeo disponível nem se as aulas publicadas anteriores
-- foram concluídas. A validação disso vivia só na Server Action
-- (markLessonCompleteAction), que é defesa em profundidade incompleta: RLS
-- sozinha já permitia a gravação arbitrária.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reforça as policies existentes: gravação direta do cliente só é aceita
--    com completed = false. Marcar como concluída só é possível através da
--    função complete_lesson() abaixo.
-- -----------------------------------------------------------------------------
drop policy if exists "lesson_progress_insert_own" on public.lesson_progress;
drop policy if exists "lesson_progress_update_own" on public.lesson_progress;

create policy "lesson_progress_insert_own" on public.lesson_progress
  for insert
  with check (
    user_id = auth.uid()
    and completed = false
    and exists (
      select 1
      from public.lessons l
      join public.course_modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      join public.enrollments e on e.course_id = c.id
      where l.id = lesson_progress.lesson_id
        and l.status in ('coming_soon', 'published')
        and c.status = 'published'
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );

create policy "lesson_progress_update_own" on public.lesson_progress
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and completed = false
    and exists (
      select 1
      from public.lessons l
      join public.course_modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      join public.enrollments e on e.course_id = c.id
      where l.id = lesson_progress.lesson_id
        and l.status in ('coming_soon', 'published')
        and c.status = 'published'
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- 2. complete_lesson(p_lesson_id) — único caminho para marcar uma aula como
--    concluída. Valida, nesta ordem: usuário autenticado, aula existe,
--    matrícula ativa no curso (e curso publicado), aula publicada (nunca
--    draft nem coming_soon — aula coming_soon não tem vídeo pra concluir),
--    aula tem vídeo cadastrado, e todas as aulas PUBLICADAS anteriores (na
--    ordem módulo -> aula, comparação de tupla) já estão concluídas por
--    este usuário.
--
--    SECURITY DEFINER É NECESSÁRIO aqui, não só uma escolha por
--    conveniência: o INSERT/UPDATE final desta função precisa gravar
--    completed = true, e é exatamente isso que a policy do passo 1 acima
--    proíbe pra um UPDATE/INSERT comum do cliente. Rodando como definer (o
--    dono da função — normalmente `postgres`, o role que aplica as
--    migrations), a gravação final não passa pela mesma checagem de
--    `with check (completed = false)` que se aplicaria a um caller comum —
--    é essa elevação, deliberada e só para este INSERT/UPDATE específico,
--    que faz da função o único caminho válido de conclusão.
--
--    `search_path` fixo em `public` evita shadowing de tabela/função.
--    EXECUTE é revogado de `public` e concedido só para `authenticated` —
--    anônimo não pode chamar. `p_lesson_id` é o único parâmetro: o usuário
--    NUNCA é recebido como argumento, sempre sai de auth.uid() dentro da
--    função, então não existe forma de um usuário concluir aula em nome de
--    outro.
-- -----------------------------------------------------------------------------
create or replace function public.complete_lesson(p_lesson_id uuid)
returns public.lesson_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_module_id uuid;
  v_lesson_status text;
  v_video_id text;
  v_lesson_order integer;
  v_course_id uuid;
  v_module_order integer;
  v_course_status text;
  v_enrollment_status text;
  v_incomplete_prior_count integer;
  v_result public.lesson_progress;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  select l.module_id, l.status, l.video_id, l.order_index
    into v_module_id, v_lesson_status, v_video_id, v_lesson_order
  from public.lessons l
  where l.id = p_lesson_id;

  if v_module_id is null then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  select m.course_id, m.order_index
    into v_course_id, v_module_order
  from public.course_modules m
  where m.id = v_module_id;

  select c.status into v_course_status
  from public.courses c
  where c.id = v_course_id;

  select e.status into v_enrollment_status
  from public.enrollments e
  where e.course_id = v_course_id
    and e.user_id = v_user_id;

  if v_course_status is distinct from 'published'
     or v_enrollment_status is distinct from 'active' then
    raise exception 'Sem acesso a esta aula.' using errcode = '42501';
  end if;

  if v_lesson_status is distinct from 'published' then
    raise exception 'Esta aula ainda não pode ser concluída.' using errcode = '42501';
  end if;

  if v_video_id is null then
    raise exception 'Esta aula ainda não tem vídeo disponível.' using errcode = '42501';
  end if;

  -- Toda aula PUBLICADA anterior (módulo, depois ordem dentro do módulo —
  -- comparação de tupla, igual ao computeLessonUnlockMap do app) precisa
  -- estar concluída por este usuário.
  select count(*)
    into v_incomplete_prior_count
  from public.lessons pl
  join public.course_modules pm on pm.id = pl.module_id
  left join public.lesson_progress pp
    on pp.lesson_id = pl.id
    and pp.user_id = v_user_id
    and pp.completed = true
  where pm.course_id = v_course_id
    and pl.status = 'published'
    and (pm.order_index, pl.order_index) < (v_module_order, v_lesson_order)
    and pp.lesson_id is null;

  if v_incomplete_prior_count > 0 then
    raise exception 'Conclua as aulas anteriores primeiro.' using errcode = '42501';
  end if;

  insert into public.lesson_progress (user_id, lesson_id, completed, percent_complete, completed_at)
  values (v_user_id, p_lesson_id, true, 100, now())
  on conflict (user_id, lesson_id) do update set
    completed = true,
    percent_complete = 100,
    completed_at = now(),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.complete_lesson(uuid) from public;
grant execute on function public.complete_lesson(uuid) to authenticated;
