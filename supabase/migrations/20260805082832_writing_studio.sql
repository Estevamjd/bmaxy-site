-- =============================================================================
--  BMaxy — Estúdio de Escrita: projetos e capítulos do aluno
-- =============================================================================
--
--  Duas tabelas novas. Nada existente é alterado.
--
--  O DADO MAIS SENSÍVEL DO PROJETO
--  -------------------------------
--  Um manuscrito não é "mais um registro". É trabalho autoral inédito de uma
--  pessoa que confiou na plataforma para guardá-lo. Vazar o progresso de uma
--  aula é constrangedor; vazar o livro que alguém está escrevendo é outra
--  categoria de dano — e irreversível, porque não se "des-lê" um manuscrito.
--
--  Por isso a RLS aqui é mais restritiva que a do resto do sistema, e de
--  propósito diverge do padrão das outras tabelas:
--
--    *** NÃO EXISTE `is_admin()` EM NENHUMA POLICY DESTE ARQUIVO. ***
--
--  Em `courses`, `lessons` e `enrollments` o administrador lê tudo, porque
--  aquilo é conteúdo do produto e ele precisa operar. Aqui não: o
--  administrador NÃO deve conseguir ler silenciosamente o manuscrito de
--  ninguém. Se um dia o aluno quiser feedback, isso vira uma ação explícita
--  dele — "enviar capítulo para avaliação" —, com registro e consentimento.
--  A arquitetura já reserva espaço para isso (ver `shared_for_review_at`), mas
--  a leitura administrativa NÃO está implementada, e ligá-la exige decisão do
--  cliente e aviso ao aluno.
--
--  Quem precisa operar sobre estes dados sem ser o dono — suporte, migração,
--  backup — usa a service_role, que ignora RLS e deixa rastro fora do banco.
--  Isso é deliberado: o caminho tem que ser incômodo o suficiente para não
--  virar rotina.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. writing_projects — o livro que o aluno está escrevendo
-- -----------------------------------------------------------------------------

create table if not exists public.writing_projects (
  id uuid primary key default gen_random_uuid(),

  -- `on delete cascade`: se a conta some, o manuscrito some junto. É o
  -- comportamento que a pessoa espera de um dado dela — e o que a política de
  -- privacidade vai precisar prometer.
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null default '',
  -- Gênero/categoria em texto livre: uma lista fechada erraria mais do que
  -- acertaria neste momento, e migrar texto para enum depois é barato.
  genre text not null default '',
  description text not null default '',

  -- Meta OPCIONAL de palavras. `null` = sem meta, que é diferente de zero.
  word_goal integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Espaço reservado para o fluxo futuro de avaliação. Fica NULL, e nenhuma
  -- policy o consulta ainda — está aqui para que ligar o recurso amanhã não
  -- exija mexer na tabela que já guarda manuscrito.
  shared_for_review_at timestamptz,

  -- Limites no BANCO, não só no formulário. Validação de cliente é conforto;
  -- esta é a que vale quando alguém chama o PostgREST direto.
  constraint writing_projects_title_len check (char_length(title) <= 200),
  constraint writing_projects_genre_len check (char_length(genre) <= 80),
  constraint writing_projects_description_len check (char_length(description) <= 2000),
  constraint writing_projects_word_goal_sane
    check (word_goal is null or (word_goal > 0 and word_goal <= 5000000))
);

comment on table public.writing_projects is
  'Manuscritos dos alunos. Conteúdo autoral privado: nenhuma policy dá acesso a administrador.';

create index if not exists writing_projects_user_idx
  on public.writing_projects (user_id, updated_at desc);


-- -----------------------------------------------------------------------------
--  2. writing_chapters — os capítulos
-- -----------------------------------------------------------------------------

create table if not exists public.writing_chapters (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.writing_projects(id) on delete cascade,

  /* O `user_id` é DENORMALIZADO de propósito, e não é descuido.
     Sem ele, toda policy de capítulo precisaria de um EXISTS na tabela de
     projetos — uma subconsulta por linha, em cada leitura e cada gravação do
     autosave. Com ele, a policy é uma comparação direta com `auth.uid()`.
     A integridade entre os dois é garantida pelo trigger abaixo, não pela
     confiança em quem escreve. */
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null default '',
  content text not null default '',
  order_index integer not null default 0,

  /* Contagem calculada pelo BANCO, no trigger, a partir do próprio conteúdo.
     Não está no grant de UPDATE: não é um campo que alguém envia, é uma
     consequência do texto. Se viesse do formulário seria um número que o
     aluno escolhe, e a soma do painel viraria ficção. */
  word_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint writing_chapters_title_len check (char_length(title) <= 200),
  -- ~2 MB por capítulo. Um capítulo de romance tem 20-40 KB; este teto existe
  -- para impedir que o autosave vire vetor de abuso de armazenamento.
  constraint writing_chapters_content_len check (char_length(content) <= 2000000),
  constraint writing_chapters_word_count_sane check (word_count >= 0),
  constraint writing_chapters_order_unique unique (project_id, order_index)
    deferrable initially deferred
);

comment on table public.writing_chapters is
  'Capítulos dos manuscritos. user_id é denormalizado para a RLS não precisar de subconsulta; o trigger garante que ele acompanhe o projeto.';

create index if not exists writing_chapters_project_idx
  on public.writing_chapters (project_id, order_index);


-- -----------------------------------------------------------------------------
--  3. O trigger que impede a denormalização de virar buraco
-- -----------------------------------------------------------------------------
--
--  Sem isto, um aluno poderia inserir um capítulo com `project_id` de OUTRA
--  pessoa e `user_id` dele mesmo: a policy olharia só o `user_id`, aprovaria,
--  e o capítulo apareceria dentro do projeto alheio. É o IDOR clássico desta
--  modelagem.
--
--  O trigger não confia no `user_id` enviado: ele SOBRESCREVE com o dono real
--  do projeto. Se o projeto não for de quem está chamando, a policy rejeita
--  logo depois, porque o valor gravado deixa de bater com `auth.uid()`.

create or replace function public.writing_chapter_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dono uuid;
  v_limpo text;
begin
  select p.user_id into v_dono
  from public.writing_projects p
  where p.id = new.project_id;

  if v_dono is null then
    raise exception 'Projeto não encontrado.' using errcode = 'P0002';
  end if;

  -- O dono do projeto MANDA. O que veio no insert/update é ignorado.
  new.user_id := v_dono;
  new.updated_at := now();

  /* Contagem de palavras: aqui, e não na aplicação. Assim ela é sempre
     coerente com o `content` que está gravado, independentemente de quem
     escreveu — a UI, um script, ou uma chamada direta ao PostgREST.

     `regexp_replace` normaliza qualquer sequência de espaço/quebra em um
     espaço só; `nullif` trata o texto vazio, onde `regexp_split_to_array`
     devolveria um array de um elemento vazio e contaria 1 palavra num
     capítulo em branco. */
  v_limpo := btrim(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'));
  new.word_count := coalesce(
    array_length(regexp_split_to_array(nullif(v_limpo, ''), ' '), 1),
    0
  );

  return new;
end;
$$;

drop trigger if exists writing_chapters_owner on public.writing_chapters;
create trigger writing_chapters_owner
  before insert or update on public.writing_chapters
  for each row execute function public.writing_chapter_owner();

-- `updated_at` do projeto, pelo mesmo motivo de sempre: se vier do cliente, é
-- decoração.
create or replace function public.writing_project_touch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists writing_projects_touch on public.writing_projects;
create trigger writing_projects_touch
  before update on public.writing_projects
  for each row execute function public.writing_project_touch();


-- -----------------------------------------------------------------------------
--  4. RLS — propriedade, e só propriedade
-- -----------------------------------------------------------------------------

alter table public.writing_projects enable row level security;
alter table public.writing_chapters enable row level security;

/* `to authenticated` sozinho NÃO é proteção: significa "qualquer pessoa
   logada", o que inclui todos os outros alunos. A condição que importa é a
   comparação com auth.uid(), no USING e no WITH CHECK.

   USING decide quais linhas a pessoa ENXERGA. WITH CHECK decide como as
   linhas podem FICAR depois da escrita. Os dois são necessários: só com
   USING, alguém poderia pegar uma linha própria e reatribuí-la a outro
   user_id. */

create policy writing_projects_select_own on public.writing_projects
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy writing_projects_insert_own on public.writing_projects
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy writing_projects_update_own on public.writing_projects
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy writing_projects_delete_own on public.writing_projects
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy writing_chapters_select_own on public.writing_chapters
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy writing_chapters_insert_own on public.writing_chapters
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy writing_chapters_update_own on public.writing_chapters
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy writing_chapters_delete_own on public.writing_chapters
  for delete to authenticated
  using (user_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
--  5. Grants — superfície mínima
-- -----------------------------------------------------------------------------

revoke all on public.writing_projects from public, anon;
revoke all on public.writing_chapters from public, anon;

/* `user_id` fica FORA do grant de UPDATE nas duas tabelas. A policy já
   impediria a mudança, mas tirar o privilégio remove a possibilidade antes de
   a policy precisar julgar — e protege contra o dia em que alguém editar a
   policy sem lembrar o que ela sustentava.

   `word_count` também fica de fora: quem calcula é o servidor. */
grant select, insert, delete on public.writing_projects to authenticated;
grant update (title, genre, description, word_goal)
  on public.writing_projects to authenticated;

grant select, insert, delete on public.writing_chapters to authenticated;
grant update (title, content, order_index)
  on public.writing_chapters to authenticated;
