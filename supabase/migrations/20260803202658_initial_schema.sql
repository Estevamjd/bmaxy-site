-- =============================================================================
-- BMaxy — schema inicial da plataforma (perfis, papéis, curso, matrícula,
-- progresso) e Row Level Security.
--
-- Convenção: toda tabela sensível tem RLS ligado e SEM policy "permissive"
-- implícita — se não existe policy pra um caso, o acesso é negado por padrão.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Função utilitária: updated_at automático.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- TABELAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles — dados de perfil, 1:1 com auth.users. NUNCA guarda permissão.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  locale text not null default 'pt' check (locale in ('pt', 'en')),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_roles — autorização de verdade. Fica FORA de auth.users.raw_user_meta_data
-- de propósito: esse campo é editável pelo próprio usuário via
-- supabase.auth.updateUser(), então nunca pode ser a fonte de permissão.
-- Um usuário tem no máximo uma role (user_id é a própria PK).
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);
-- user_id já é PK (índice único automático) — cobre o índice pedido em
-- user_roles.user_id sem precisar de um índice duplicado.

-- -----------------------------------------------------------------------------
-- courses
-- -----------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_pt text not null,
  title_en text not null,
  description_pt text not null default '',
  description_en text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- course_modules
-- -----------------------------------------------------------------------------
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title_pt text not null,
  title_en text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, order_index)
);

create index course_modules_course_id_idx on public.course_modules(course_id);
-- unique(course_id, order_index) acima já cria um índice que cobre a
-- ordenação por curso — é o índice "campos usados para ordenação" pedido
-- para esta tabela.

create trigger course_modules_set_updated_at
  before update on public.course_modules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- lessons — não guarda HTML de iframe, só provedor + id do vídeo.
-- -----------------------------------------------------------------------------
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title_pt text not null,
  title_en text not null,
  description_pt text not null default '',
  description_en text not null default '',
  order_index integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'coming_soon', 'published')),
  video_provider text check (video_provider in ('youtube')),
  video_id text,
  duration_seconds integer,
  -- Reservado para uma futura liberação de prévia sem matrícula. Nesta MVP a
  -- RLS abaixo NÃO usa este campo — toda aula exige matrícula ativa, sem
  -- exceção. Ver nota na policy lessons_select_enrolled.
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, order_index),
  constraint lessons_video_id_requires_provider
    check (video_id is null or video_provider is not null)
);

create index lessons_module_id_idx on public.lessons(module_id);
-- unique(module_id, order_index) acima cobre o índice de ordenação desta
-- tabela.

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- enrollments
-- -----------------------------------------------------------------------------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  source text not null default 'manual' check (source in ('manual', 'payment')),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index enrollments_user_id_idx on public.enrollments(user_id);
create index enrollments_course_id_idx on public.enrollments(course_id);

create trigger enrollments_set_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- lesson_progress
-- -----------------------------------------------------------------------------
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  watched_seconds integer not null default 0,
  duration_seconds integer,
  percent_complete integer not null default 0 check (percent_complete between 0 and 100),
  completed boolean not null default false,
  completed_at timestamptz,
  last_position_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index lesson_progress_user_id_idx on public.lesson_progress(user_id);
create index lesson_progress_lesson_id_idx on public.lesson_progress(lesson_id);

create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- =============================================================================
-- is_admin() — função de checagem de permissão usada nas policies abaixo.
--
-- SECURITY DEFINER, com motivo documentado (pedido explicitamente):
--
-- A policy "user_roles_admin_all" (mais abaixo) usa is_admin() para decidir
-- se o chamador pode ler/escrever QUALQUER linha de user_roles. Se is_admin()
-- fizesse a consulta interna como INVOKER (o usuário logado comum), essa
-- mesma consulta acionaria a política de novo — recursão infinita.
--
-- Rodando como DEFINER (dono da função — normalmente o role usado para
-- aplicar a migration, ex. `postgres`), a consulta interna do is_admin()
-- executa com o privilégio do DONO da tabela, que por padrão ignora RLS nas
-- próprias tabelas (a menos que FORCE ROW LEVEL SECURITY esteja ativo, o que
-- não fazemos aqui). Isso quebra o ciclo: a checagem interna nunca reaciona
-- a policy que a chamou.
--
-- `search_path` fixo em `public` evita um ataque de "function/table
-- shadowing" (alguém criar um `user_roles` num schema diferente e mais cedo
-- no search_path para enganar a função). EXECUTE é revogado de `public` e
-- concedido só para `authenticated` — anônimo não pode nem chamar a função.
-- A função só olha `auth.uid()` (o próprio chamador), nunca recebe um user_id
-- por parâmetro, então não dá pra usá-la pra descobrir a role de outra
-- pessoa.
-- =============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- =============================================================================
-- Perfil + role padrão automáticos ao criar usuário no Auth.
-- Mesmo raciocínio de SECURITY DEFINER acima: o trigger roda em auth.users,
-- fora do controle do usuário recém-criado, e precisa inserir em profiles e
-- user_roles antes que qualquer policy de aplicação exista para ele.
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  -- Todo usuário novo nasce "student". Promover a admin é uma ação
  -- deliberada e separada (ver docs/SETUP-MVP.md), nunca automática.
  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;

-- -----------------------------------------------------------------------------
-- profiles: cada um vê e edita só o próprio perfil. Não há coluna de
-- permissão aqui, então "editar o próprio perfil" nunca vira "se promover".
-- -----------------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- user_roles: leitura só da própria linha; NENHUMA policy de insert/update
-- /delete para usuário comum — só admin pode escrever aqui. É isso que
-- impede um aluno de se auto-promover.
-- -----------------------------------------------------------------------------
create policy "user_roles_select_own" on public.user_roles
  for select using (user_id = auth.uid());

create policy "user_roles_admin_all" on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- courses: aluno só vê curso publicado em que tem matrícula ativa.
-- Anônimo não vê nada (nenhuma policy pra role anon).
-- -----------------------------------------------------------------------------
create policy "courses_select_enrolled" on public.courses
  for select using (
    status = 'published'
    and exists (
      select 1
      from public.enrollments e
      where e.course_id = courses.id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );

create policy "courses_admin_all" on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- course_modules: mesma regra, atravessando course_id.
-- -----------------------------------------------------------------------------
create policy "course_modules_select_enrolled" on public.course_modules
  for select using (
    exists (
      select 1
      from public.courses c
      join public.enrollments e on e.course_id = c.id
      where c.id = course_modules.course_id
        and c.status = 'published'
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );

create policy "course_modules_admin_all" on public.course_modules
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- lessons: aula "draft" nunca aparece pro aluno (nem published nem
-- coming_soon cobre draft). is_preview NÃO é usado aqui nesta MVP — toda
-- aula, mesmo a primeira, exige matrícula ativa. Ver comentário na coluna.
-- -----------------------------------------------------------------------------
create policy "lessons_select_enrolled" on public.lessons
  for select using (
    status in ('coming_soon', 'published')
    and exists (
      select 1
      from public.course_modules m
      join public.courses c on c.id = m.course_id
      join public.enrollments e on e.course_id = c.id
      where m.id = lessons.module_id
        and c.status = 'published'
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );

create policy "lessons_admin_all" on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- enrollments: aluno só vê as próprias. Só admin cria/edita/revoga
-- (matrícula é sempre manual nesta MVP — sem pagamento).
-- -----------------------------------------------------------------------------
create policy "enrollments_select_own" on public.enrollments
  for select using (user_id = auth.uid());

create policy "enrollments_admin_all" on public.enrollments
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- lesson_progress: aluno lê/insere/atualiza só o próprio progresso, e só
-- para aula à qual ele realmente tem acesso agora (mesma checagem de
-- matrícula ativa + status da aula usada em lessons_select_enrolled). Isso
-- fecha o caso de alguém inserir progresso numa aula de curso em que nunca
-- foi matriculado só porque sabe o lesson_id.
-- -----------------------------------------------------------------------------
create policy "lesson_progress_select_own" on public.lesson_progress
  for select using (user_id = auth.uid());

create policy "lesson_progress_insert_own" on public.lesson_progress
  for insert
  with check (
    user_id = auth.uid()
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

create policy "lesson_progress_admin_all" on public.lesson_progress
  for all using (public.is_admin()) with check (public.is_admin());
