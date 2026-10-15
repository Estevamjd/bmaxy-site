-- =============================================================================
-- BMaxy — a matrícula gratuita automática pertence ao cadastro público.
--
-- Contas criadas pelo painel continuam sem matrícula até o administrador
-- liberar o curso explicitamente. Isso também evita contabilizar o próprio
-- administrador como uma matrícula ativa.
-- =============================================================================

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

  if coalesce(new.raw_user_meta_data ->> 'signup_source', '') = 'public' then
    insert into public.enrollments (user_id, course_id, status, source)
    select new.id, c.id, 'active', 'signup'
    from public.courses c
    where c.slug = 'seu-livro'
    on conflict (user_id, course_id) do update set
      status = 'active',
      source = 'signup',
      granted_by = null,
      updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
