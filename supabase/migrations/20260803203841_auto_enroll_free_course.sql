-- =============================================================================
-- BMaxy — todo cadastro recebe acesso gratuito ao curso "Seu Livro".
--
-- A promessa pública é que a conta libera a aula 1 sem cobrança. A matrícula
-- nasce no mesmo trigger que cria profile e role; assim funciona tanto com
-- confirmação de e-mail ligada quanto desligada e não depende do navegador.
-- =============================================================================

alter table public.enrollments
  drop constraint if exists enrollments_source_check;

alter table public.enrollments
  add constraint enrollments_source_check
  check (source in ('manual', 'payment', 'signup'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id) do nothing;

  insert into public.enrollments (user_id, course_id, status, source)
  select new.id, c.id, 'active', 'signup'
  from public.courses c
  where c.slug = 'seu-livro'
  on conflict (user_id, course_id) do update set
    status = 'active',
    source = 'signup',
    granted_by = null,
    updated_at = now();

  return new;
end;
$$;

-- Trigger interno: nunca deve aparecer como RPC para anon/authenticated.
revoke all on function public.handle_new_user() from public, anon, authenticated;
