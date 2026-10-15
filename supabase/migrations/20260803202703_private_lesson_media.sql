-- =============================================================================
--  BMaxy — o ID do vídeo sai de public.lessons e vira mídia privada
-- =============================================================================
--
--  MIGRATION INCREMENTAL. Não edite 20260802120000_initial_schema.sql nem
--  20260803090000_secure_lesson_completion.sql: as duas já podem estar
--  aplicadas em algum ambiente. Tudo aqui é acréscimo ou substituição por
--  `create or replace`.
--
--  O PROBLEMA QUE ISTO FECHA
--  -------------------------
--  A policy `lessons_select_enrolled` (schema inicial) libera SELECT em
--  public.lessons para qualquer aluno com matrícula ativa no curso, desde que
--  a aula esteja em 'coming_soon' ou 'published'. Isso é o certo para título,
--  descrição e ordem — mas a linha inteira inclui `video_id`.
--
--  Resultado: um aluno matriculado que ainda não concluiu a aula 1 podia
--  simplesmente pedir
--
--      supabase.from('lessons').select('video_id')
--
--  e receber o ID do YouTube de TODAS as aulas publicadas do curso, inclusive
--  as bloqueadas pela sequência. O bloqueio existia só na interface e na
--  função de conclusão; a leitura do dado que dá acesso ao conteúdo estava
--  aberta. Nenhuma policy de RLS resolve isso sozinha, porque RLS filtra
--  LINHAS, não COLUNAS.
--
--  A SOLUÇÃO
--  ---------
--  1. `public.lesson_media` — tabela nova, só com provider + id do vídeo.
--     RLS ligada e NENHUMA policy: sem policy, RLS nega tudo. Nem `anon` nem
--     `authenticated` leem esta tabela por API, em nenhuma circunstância.
--     Quem alcança é só quem ignora RLS: a `service_role` (painel
--     administrativo, via createAdminClient) e funções `security definer`.
--  2. `public.lessons.has_video` — booleano mantido por trigger. A interface
--     precisa saber se existe vídeo para escolher entre o player e o aviso
--     "em breve"; saber que EXISTE não entrega o conteúdo, então este campo
--     pode continuar visível pela policy normal de lessons.
--  3. `public.get_lesson_playback(uuid)` — a única porta de entrada do
--     video_id para um aluno. Valida, nesta ordem: autenticado, aula existe,
--     curso publicado + matrícula ativa, aula publicada, todas as aulas
--     publicadas anteriores concluídas, e só então devolve provider + id.
--  4. `complete_lesson()` recriada: lia `lessons.video_id`, que deixa de
--     existir. Passa a olhar `lesson_media`. A regra não muda.
--
--  ATENÇÃO AO APLICAR: esta migration REMOVE as colunas video_provider e
--  video_id de public.lessons. O código da aplicação já foi ajustado no mesmo
--  commit (src/lib/dal/student.ts, src/lib/dal/admin.ts,
--  src/lib/supabase/types.ts). Aplicar a migration sem subir o código — ou o
--  contrário — quebra as duas pontas. Elas andam juntas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela privada de mídia
-- -----------------------------------------------------------------------------
create table if not exists public.lesson_media (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  video_provider text not null check (video_provider in ('youtube')),
  video_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.lesson_media is
  'Provider e ID do vídeo de cada aula. RLS ligada SEM policies de propósito: '
  'nada aqui é legível pela API pública. O aluno só obtém estes dados por '
  'public.get_lesson_playback(), que valida matrícula, status e sequência.';

-- Move o que já existir em lessons para cá, antes de derrubar as colunas.
insert into public.lesson_media (lesson_id, video_provider, video_id)
select l.id, l.video_provider, l.video_id
from public.lessons l
where l.video_id is not null
  and l.video_provider is not null
on conflict (lesson_id) do nothing;

alter table public.lesson_media enable row level security;

-- Sem `create policy` nenhuma: RLS ligada e sem policy = nega tudo para
-- anon e authenticated. Não acrescente policy de leitura aqui — se um dia
-- alguém precisar destes dados, o caminho é uma função security definer que
-- valide o acesso, como a de baixo.

-- Revoga também os privilégios de tabela: RLS já barra, mas sem isto a
-- tabela continuaria aparecendo como "existe" para o PostgREST.
revoke all on table public.lesson_media from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. lessons.has_video — o que a interface pode saber sem receber o vídeo
-- -----------------------------------------------------------------------------
alter table public.lessons
  add column if not exists has_video boolean not null default false;

comment on column public.lessons.has_video is
  'Existe vídeo cadastrado para esta aula? Mantido por trigger a partir de '
  'lesson_media. Saber que existe não entrega o conteúdo — por isso este '
  'campo pode ser lido pela policy normal de lessons, e o video_id não.';

create or replace function public.sync_lesson_has_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.lessons set has_video = false, updated_at = now()
    where id = old.lesson_id;
    return old;
  end if;

  update public.lessons set has_video = true, updated_at = now()
  where id = new.lesson_id;

  -- UPDATE que troca a aula de lugar: a antiga pode ter ficado sem mídia.
  if tg_op = 'UPDATE' and old.lesson_id is distinct from new.lesson_id then
    update public.lessons l
    set has_video = exists (select 1 from public.lesson_media m where m.lesson_id = l.id),
        updated_at = now()
    where l.id = old.lesson_id;
  end if;

  return new;
end;
$$;

drop trigger if exists lesson_media_sync_has_video on public.lesson_media;
create trigger lesson_media_sync_has_video
  after insert or update or delete on public.lesson_media
  for each row execute function public.sync_lesson_has_video();

-- Sincroniza o estado inicial (as linhas inseridas acima não passaram pelo
-- trigger, que só foi criado agora).
update public.lessons l
set has_video = exists (select 1 from public.lesson_media m where m.lesson_id = l.id);

-- -----------------------------------------------------------------------------
-- 3. As colunas saem de public.lessons
-- -----------------------------------------------------------------------------
-- A constraint lessons_video_id_requires_provider some junto com as colunas.
alter table public.lessons drop column if exists video_id;
alter table public.lessons drop column if exists video_provider;

-- -----------------------------------------------------------------------------
-- 4. get_lesson_playback() — a única porta do video_id para o aluno
-- -----------------------------------------------------------------------------
-- security definer porque precisa ler public.lesson_media, que é justamente
-- a tabela que ninguém alcança por RLS. search_path fixo para a função não
-- poder ser sequestrada por um schema plantado no search_path da sessão.
--
-- O identificador do usuário vem SEMPRE de auth.uid(), nunca de parâmetro:
-- se viesse por parâmetro, qualquer aluno pediria o vídeo em nome de outro.
--
-- As validações são as MESMAS de complete_lesson(), na mesma ordem — as duas
-- respondem à pergunta "esta pessoa pode estar nesta aula agora?". Se um dia
-- a regra de desbloqueio mudar, as duas funções mudam juntas.
create or replace function public.get_lesson_playback(p_lesson_id uuid)
returns table (video_provider text, video_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_module_id uuid;
  v_lesson_status text;
  v_lesson_order integer;
  v_course_id uuid;
  v_module_order integer;
  v_course_status text;
  v_enrollment_status text;
  v_incomplete_prior_count integer;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  select l.module_id, l.status, l.order_index
    into v_module_id, v_lesson_status, v_lesson_order
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
  from public.courses c where c.id = v_course_id;

  select e.status into v_enrollment_status
  from public.enrollments e
  where e.course_id = v_course_id and e.user_id = v_user_id;

  if v_course_status is distinct from 'published'
     or v_enrollment_status is distinct from 'active' then
    raise exception 'Sem acesso a esta aula.' using errcode = '42501';
  end if;

  -- 'coming_soon' e 'draft' não entregam vídeo. Uma aula "em breve" pode até
  -- ter mídia cadastrada antes da estreia; ela continua fora do alcance.
  if v_lesson_status is distinct from 'published' then
    raise exception 'Esta aula ainda não está disponível.' using errcode = '42501';
  end if;

  -- O bloqueio sequencial. Conta as aulas publicadas ANTERIORES (comparação
  -- por tupla: módulo primeiro, depois a ordem dentro do módulo) que ainda
  -- não foram concluídas por este aluno. Qualquer uma > 0 barra.
  select count(*) into v_incomplete_prior_count
  from public.lessons pl
  join public.course_modules pm on pm.id = pl.module_id
  left join public.lesson_progress pp
    on pp.lesson_id = pl.id and pp.user_id = v_user_id and pp.completed = true
  where pm.course_id = v_course_id
    and pl.status = 'published'
    and (pm.order_index, pl.order_index) < (v_module_order, v_lesson_order)
    and pp.lesson_id is null;

  if v_incomplete_prior_count > 0 then
    raise exception 'Conclua as aulas anteriores primeiro.' using errcode = '42501';
  end if;

  return query
  select m.video_provider, m.video_id
  from public.lesson_media m
  where m.lesson_id = p_lesson_id;
end;
$$;

revoke all on function public.get_lesson_playback(uuid) from public, anon;
grant execute on function public.get_lesson_playback(uuid) to authenticated;

comment on function public.get_lesson_playback(uuid) is
  'Devolve provider + id do vídeo de uma aula APENAS se o chamador estiver '
  'autenticado, com matrícula ativa em curso publicado, a aula estiver '
  'publicada e todas as aulas publicadas anteriores já concluídas.';

-- -----------------------------------------------------------------------------
-- 5. complete_lesson() recriada — lia lessons.video_id, que não existe mais
-- -----------------------------------------------------------------------------
-- Mesma regra de antes; muda só ONDE ela procura o vídeo. Continua sendo o
-- único caminho autorizado a gravar completed = true (as policies de
-- lesson_progress da migration anterior exigem completed = false no
-- with check, então insert/update direto do cliente não consegue concluir).
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
  v_has_media boolean;
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

  select l.module_id, l.status, l.order_index
    into v_module_id, v_lesson_status, v_lesson_order
  from public.lessons l
  where l.id = p_lesson_id;

  if v_module_id is null then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  select exists (select 1 from public.lesson_media m where m.lesson_id = p_lesson_id)
    into v_has_media;

  select m.course_id, m.order_index
    into v_course_id, v_module_order
  from public.course_modules m
  where m.id = v_module_id;

  select c.status into v_course_status
  from public.courses c where c.id = v_course_id;

  select e.status into v_enrollment_status
  from public.enrollments e
  where e.course_id = v_course_id and e.user_id = v_user_id;

  if v_course_status is distinct from 'published'
     or v_enrollment_status is distinct from 'active' then
    raise exception 'Sem acesso a esta aula.' using errcode = '42501';
  end if;

  if v_lesson_status is distinct from 'published' then
    raise exception 'Esta aula ainda não pode ser concluída.' using errcode = '42501';
  end if;

  if not v_has_media then
    raise exception 'Esta aula ainda não tem vídeo disponível.' using errcode = '42501';
  end if;

  select count(*) into v_incomplete_prior_count
  from public.lessons pl
  join public.course_modules pm on pm.id = pl.module_id
  left join public.lesson_progress pp
    on pp.lesson_id = pl.id and pp.user_id = v_user_id and pp.completed = true
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

revoke all on function public.complete_lesson(uuid) from public, anon;
grant execute on function public.complete_lesson(uuid) to authenticated;
