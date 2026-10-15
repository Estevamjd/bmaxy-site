-- =============================================================================
-- BMaxy — endurecimento de permissões da API e otimização das policies RLS.
--
-- Esta migration roda depois de private_lesson_media. Ela:
--   1. remove privilégios amplos de anon;
--   2. expõe a authenticated somente o necessário;
--   3. impede chamada direta de funções internas de trigger;
--   4. restringe todas as policies ao papel authenticated;
--   5. combina acesso próprio + administrativo em uma policy por operação;
--   6. evita recalcular auth.uid()/is_admin() para cada linha;
--   7. adiciona o índice ausente da FK enrollments.granted_by.
-- =============================================================================

-- Novos objetos não devem nascer expostos automaticamente.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Revoga a superfície herdada e concede somente o que a aplicação usa.
revoke all on all tables in schema public from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, locale, must_change_password) on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;

grant select, insert, update, delete on table public.courses to authenticated;
grant select, insert, update, delete on table public.course_modules to authenticated;
grant select, insert, update, delete on table public.lessons to authenticated;
grant select, insert, update, delete on table public.enrollments to authenticated;
grant select, insert, update, delete on table public.lesson_progress to authenticated;

-- lesson_media permanece privada: apenas service_role e funções definer.
revoke all on table public.lesson_media from public, anon, authenticated;

-- Funções de trigger não são endpoints RPC. As duas funções de aluno e a
-- função usada pelas policies são as únicas executáveis por authenticated.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_lesson_playback(uuid) to authenticated;
grant execute on function public.complete_lesson(uuid) to authenticated;

-- search_path imutável em todas as funções, inclusive as que não são definer.
-- Os corpos já qualificam tabelas/funções com public./auth.; pg_catalog é
-- pesquisado implicitamente mesmo com search_path vazio.
alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = '';
alter function public.is_admin() set search_path = '';
alter function public.sync_lesson_has_video() set search_path = '';
alter function public.get_lesson_playback(uuid) set search_path = '';
alter function public.complete_lesson(uuid) set search_path = '';

create index if not exists enrollments_granted_by_idx
  on public.enrollments(granted_by);

-- Remove as policies antigas (criadas sem TO authenticated e separadas entre
-- usuário e admin, o que gerava policies permissivas duplicadas).
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;

drop policy if exists "user_roles_select_own" on public.user_roles;
drop policy if exists "user_roles_admin_all" on public.user_roles;

drop policy if exists "courses_select_enrolled" on public.courses;
drop policy if exists "courses_admin_all" on public.courses;

drop policy if exists "course_modules_select_enrolled" on public.course_modules;
drop policy if exists "course_modules_admin_all" on public.course_modules;

drop policy if exists "lessons_select_enrolled" on public.lessons;
drop policy if exists "lessons_admin_all" on public.lessons;

drop policy if exists "enrollments_select_own" on public.enrollments;
drop policy if exists "enrollments_admin_all" on public.enrollments;

drop policy if exists "lesson_progress_select_own" on public.lesson_progress;
drop policy if exists "lesson_progress_insert_own" on public.lesson_progress;
drop policy if exists "lesson_progress_update_own" on public.lesson_progress;
drop policy if exists "lesson_progress_admin_all" on public.lesson_progress;

-- profiles
create policy "profiles_select_authorized" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "profiles_update_authorized" on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    id = (select auth.uid())
    or (select public.is_admin())
  );

-- user_roles: aluno só lê a própria role; admin lê todas. Escritas continuam
-- reservadas à service_role/SQL administrativo.
create policy "user_roles_select_authorized" on public.user_roles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

-- courses
create policy "courses_select_authorized" on public.courses
  for select to authenticated
  using (
    (select public.is_admin())
    or (
      status = 'published'
      and exists (
        select 1
        from public.enrollments e
        where e.course_id = courses.id
          and e.user_id = (select auth.uid())
          and e.status = 'active'
      )
    )
  );

create policy "courses_insert_admin" on public.courses
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "courses_update_admin" on public.courses
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "courses_delete_admin" on public.courses
  for delete to authenticated
  using ((select public.is_admin()));

-- course_modules
create policy "course_modules_select_authorized" on public.course_modules
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.courses c
      join public.enrollments e on e.course_id = c.id
      where c.id = course_modules.course_id
        and c.status = 'published'
        and e.user_id = (select auth.uid())
        and e.status = 'active'
    )
  );

create policy "course_modules_insert_admin" on public.course_modules
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "course_modules_update_admin" on public.course_modules
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "course_modules_delete_admin" on public.course_modules
  for delete to authenticated
  using ((select public.is_admin()));

-- lessons
create policy "lessons_select_authorized" on public.lessons
  for select to authenticated
  using (
    (select public.is_admin())
    or (
      status in ('coming_soon', 'published')
      and exists (
        select 1
        from public.course_modules m
        join public.courses c on c.id = m.course_id
        join public.enrollments e on e.course_id = c.id
        where m.id = lessons.module_id
          and c.status = 'published'
          and e.user_id = (select auth.uid())
          and e.status = 'active'
      )
    )
  );

create policy "lessons_insert_admin" on public.lessons
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "lessons_update_admin" on public.lessons
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "lessons_delete_admin" on public.lessons
  for delete to authenticated
  using ((select public.is_admin()));

-- enrollments
create policy "enrollments_select_authorized" on public.enrollments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "enrollments_insert_admin" on public.enrollments
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "enrollments_update_admin" on public.enrollments
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "enrollments_delete_admin" on public.enrollments
  for delete to authenticated
  using ((select public.is_admin()));

-- lesson_progress
create policy "lesson_progress_select_authorized" on public.lesson_progress
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "lesson_progress_insert_authorized" on public.lesson_progress
  for insert to authenticated
  with check (
    (select public.is_admin())
    or (
      user_id = (select auth.uid())
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
          and e.user_id = (select auth.uid())
          and e.status = 'active'
      )
    )
  );

create policy "lesson_progress_update_authorized" on public.lesson_progress
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    (select public.is_admin())
    or (
      user_id = (select auth.uid())
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
          and e.user_id = (select auth.uid())
          and e.status = 'active'
      )
    )
  );

create policy "lesson_progress_delete_admin" on public.lesson_progress
  for delete to authenticated
  using ((select public.is_admin()));
