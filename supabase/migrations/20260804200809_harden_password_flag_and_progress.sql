-- =============================================================================
--  BMaxy — endurecer a troca de senha obrigatória e a escrita de progresso
-- =============================================================================
--
--  Primeira migration escrita DEPOIS da reconciliação do histórico
--  (ver docs/MIGRATIONS.md). A partir daqui a regra vale: toda mudança de
--  schema nasce como arquivo aqui e vai por `supabase db push`.
--
--  Fecha dois buracos de ESCRITA encontrados pela revisão de segurança
--  independente em 2026-08-04. Nenhum dos dois permite que um estranho entre;
--  os dois permitem que quem já está dentro contorne uma regra do produto.
--
--  Não cria tabela, não apaga dado, não altera migration antiga.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. O aluno não apaga a própria obrigação de trocar a senha
-- -----------------------------------------------------------------------------
--
--  O problema: `20260803203311_harden_rls_and_api_permissions` concedeu
--
--      grant update (full_name, locale, must_change_password) on public.profiles
--        to authenticated;
--
--  e a policy `profiles_update_authorized` deixa a pessoa editar a própria
--  linha. Somados, o aluno faz
--
--      PATCH /rest/v1/profiles?id=eq.<ele mesmo>
--      {"must_change_password": false}
--
--  direto no PostgREST e fica PARA SEMPRE com a senha temporária que o
--  administrador escolheu e conhece. A conta criada pelo painel nunca deixa de
--  ser uma conta com segredo compartilhado.
--
--  A metade da aplicação já foi corrigida: `requireUser()` passou a checar a
--  flag em toda rota protegida, não só no login. Mas de nada adianta checar uma
--  flag que o próprio interessado pode zerar.
--
--  A correção é tirar a coluna do grant. `full_name` e `locale` continuam
--  editáveis pelo dono — são dados dele. `must_change_password` não é um dado
--  dele: é uma decisão do sistema sobre ele.

revoke update (must_change_password) on public.profiles from authenticated;

--  QUEM AINDA ESCREVE ESSA COLUNA, e por que continua funcionando:
--
--    - `createStudentAction` liga a flag (true) usando o cliente de
--      service_role, que ignora RLS e grants. Não muda nada.
--
--    - `resetPasswordAction` desliga a flag (false) e ANTES escrevia como o
--      próprio usuário — este revoke quebraria essa chamada. Por isso ela
--      passa a usar o cliente de service_role também, e só DEPOIS de
--      `auth.updateUser({ password })` retornar sucesso.
--
--  POR QUE NÃO UMA FUNÇÃO `security definer` PARA O ALUNO CHAMAR:
--  seria o desenho óbvio, e estaria errado. Uma RPC concedida a
--  `authenticated` é chamável direto pelo PostgREST — o aluno chamaria
--  `rpc('limpar_flag')` sem trocar senha nenhuma e o buraco continuaria
--  aberto, só que com um nome mais bonito. A função não tem como verificar
--  que a senha mudou: o GoTrue não expõe "senha alterada em", e
--  `auth.users.updated_at` também é tocado por login, o que tornaria a
--  checagem trivial de burlar.
--
--  A única garantia real da ORDEM (trocou a senha -> limpa a flag) é o fluxo
--  do servidor, onde a segunda chamada só existe se a primeira retornou
--  sucesso. É onde ela ficou.


-- -----------------------------------------------------------------------------
--  2. Ninguém escreve progresso alheio pela API comum
-- -----------------------------------------------------------------------------
--
--  O problema: as duas policies de escrita de `lesson_progress` começam o
--  WITH CHECK com `is_admin() OR (...)`, e `authenticated` tem INSERT/UPDATE em
--  todas as colunas, `user_id` e `completed` inclusive. Com uma sessão de
--  administrador:
--
--      POST /rest/v1/lesson_progress
--      {"user_id": "<uuid de um aluno>", "lesson_id": "<qualquer>",
--       "completed": true}
--
--  é aceito. Isso passa por cima de TUDO que `complete_lesson()` valida —
--  matrícula ativa, curso publicado, aula publicada, ordem sequencial — e
--  contradiz o invariante declarado de que aquela função é o único caminho
--  para `completed = true`.
--
--  Explorabilidade honesta: quem tem sessão de admin normalmente também tem a
--  SUPABASE_SECRET_KEY, e com ela ignora RLS de qualquer jeito. O ganho é
--  contra uma sessão de admin roubada (XSS, máquina emprestada), que hoje
--  forjaria conclusão de curso sem precisar da chave. É defesa em
--  profundidade — e é barata, porque nada no produto usa esse atalho.
--
--  Verificado antes de mexer: nenhum código escreve `lesson_progress` com
--  sessão de administrador. `src/lib/dal/admin.ts` só faz SELECT (progresso
--  recente do painel). Remover o atalho não tira funcionalidade nenhuma.
--
--  O que NÃO muda:
--    - o admin continua LENDO todo o progresso (`..._select_authorized`
--      mantém o `is_admin()` no USING) — o painel depende disso;
--    - o admin continua podendo APAGAR progresso (`..._delete_admin`), que é
--      a operação administrativa legítima de "zerar o progresso de alguém";
--    - o aluno continua só conseguindo gravar linha com `completed = false`,
--      para a própria conta, em aula de curso publicado no qual tem matrícula
--      ativa. Quem marca `completed = true` é, e continua sendo, só a função
--      `complete_lesson()`, que é `security definer` e valida a sequência.

drop policy if exists lesson_progress_insert_authorized on public.lesson_progress;

create policy lesson_progress_insert_authorized
  on public.lesson_progress
  for insert
  to authenticated
  with check (
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
  );

drop policy if exists lesson_progress_update_authorized on public.lesson_progress;

create policy lesson_progress_update_authorized
  on public.lesson_progress
  for update
  to authenticated
  -- USING mantém o is_admin(): o administrador precisa ENXERGAR a linha para
  -- que o painel funcione. Quem barra a escrita é o WITH CHECK abaixo, que não
  -- tem atalho de admin — um UPDATE administrativo simplesmente não passa.
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
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
  );


-- -----------------------------------------------------------------------------
--  3. Ordenação de conteúdo sem corrida
-- -----------------------------------------------------------------------------
--
--  O problema: `next_module_order()` / `next_lesson_order()` fazem
--  `coalesce(max(order_index), -1) + 1` e devolvem o número, que só depois é
--  usado num INSERT separado. Entre a leitura e a escrita cabe outra transação.
--  Dois administradores criando módulo ao mesmo tempo (ou um clique duplo)
--  recebem o mesmo `order_index`, e a lista passa a ter duas posições iguais —
--  com ordenação indefinida na tela e `move_module()`/`move_lesson()` trocando
--  a posição errada.
--
--  Não havia constraint impedindo — apesar de o código assumir que havia. O
--  comentário dentro de `move_module()` diz "troca em três passos por causa do
--  unique (course_id, order_index)", e `createModuleAction` trata 23505 e
--  tenta de novo. Os dois foram escritos contra uma constraint que nunca
--  existiu: o retry nunca disparava e a troca em três passos era cautela
--  contra nada. Esta migration finalmente torna a suposição verdadeira.
--
--  A correção tem duas partes, e as duas precisam existir:
--
--    - o LOCK de linha no pai serializa duas criações concorrentes no mesmo
--      curso/módulo, de modo que o `max(order_index)` da segunda já enxergue a
--      linha da primeira. É isso que torna a operação realmente atômica;
--    - a CONSTRAINT é a rede: mesmo que alguém insira por fora dessas funções,
--      duas posições iguais viram erro em vez de lista silenciosamente
--      corrompida.
--
--  A constraint é IMEDIATA, não DEFERRABLE, e isso foi verificado: a troca de
--  três passos de `move_module()`/`move_lesson()` passa o registro por -1 antes
--  de ocupar a posição do vizinho, então em nenhum instante existem duas linhas
--  com o mesmo `order_index`. Uma constraint imediata não quebra a reordenação
--  — e, ao contrário da diferida, acusa o conflito no próprio INSERT em vez de
--  só no COMMIT.

-- Duplicatas impediriam a criação da constraint. Não há nenhuma hoje (1 curso,
-- 1 módulo, 1 aula), mas a checagem torna a migration segura em qualquer banco.
do $$
declare
  duplicados integer;
begin
  select count(*) into duplicados
  from (
    select course_id, order_index from public.course_modules
    group by course_id, order_index having count(*) > 1
  ) t;
  if duplicados > 0 then
    raise exception 'Existem % posições duplicadas em course_modules. Resolva antes de aplicar.', duplicados;
  end if;

  select count(*) into duplicados
  from (
    select module_id, order_index from public.lessons
    group by module_id, order_index having count(*) > 1
  ) t;
  if duplicados > 0 then
    raise exception 'Existem % posições duplicadas em lessons. Resolva antes de aplicar.', duplicados;
  end if;
end $$;

alter table public.course_modules
  drop constraint if exists course_modules_order_unique;
alter table public.course_modules
  add constraint course_modules_order_unique unique (course_id, order_index);

alter table public.lessons
  drop constraint if exists lessons_order_unique;
alter table public.lessons
  add constraint lessons_order_unique unique (module_id, order_index);

--  As criações atômicas.
--
--  O `select ... for update` na linha PAI é o que resolve a corrida. Ele não
--  serve para ler o dado — o retorno é descartado — e sim para segurar a linha
--  do curso (ou do módulo) até o fim da transação. Duas criações simultâneas no
--  mesmo pai entram em fila: a segunda só calcula o `max(order_index)` depois
--  que a primeira já gravou a dela.
--
--  Travar o PAI, e não a tabela de filhos, é de propósito: criar módulo no
--  curso A nunca espera por uma criação no curso B.
--
--  `security definer` com `is_admin()` na primeira linha: sem isso, conceder
--  EXECUTE a `authenticated` deixaria qualquer aluno criar módulo e aula.
--  `search_path = ''` pelo mesmo motivo das outras — função definer com
--  search_path mutável pode ser induzida a resolver um nome para objeto
--  plantado em outro schema.

create or replace function public.create_module(
  p_course_id uuid,
  p_title_pt text,
  p_title_en text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curso uuid;
  v_novo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem criar módulos.' using errcode = '42501';
  end if;

  select c.id into v_curso from public.courses c where c.id = p_course_id for update;

  if v_curso is null then
    raise exception 'Curso não encontrado.' using errcode = 'P0002';
  end if;

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
--  Por isso a função não aceita `status` como parâmetro — não é um dado de
--  entrada, é uma regra.

create or replace function public.create_lesson(
  p_module_id uuid,
  p_title_pt text,
  p_title_en text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modulo uuid;
  v_novo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem criar aulas.' using errcode = '42501';
  end if;

  select m.id into v_modulo from public.course_modules m where m.id = p_module_id for update;

  if v_modulo is null then
    raise exception 'Módulo não encontrado.' using errcode = 'P0002';
  end if;

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

--  `next_module_order()` e `next_lesson_order()` continuam existindo: nada as
--  remove aqui, para não quebrar chamador que ainda não migrou. Mas elas
--  deixam de ser o caminho recomendado — quem cria conteúdo deve usar as duas
--  funções acima. Ver docs/SETUP-MVP.md.

comment on function public.next_module_order(uuid) is
  'OBSOLETA: sofre corrida entre o max() e o insert. Use create_module().';
comment on function public.next_lesson_order(uuid) is
  'OBSOLETA: sofre corrida entre o max() e o insert. Use create_lesson().';
