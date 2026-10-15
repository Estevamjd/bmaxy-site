-- =============================================================================
--  BMaxy — separa as policies de escrita por comando, em vez de FOR ALL
-- =============================================================================
--
--  Apontado pelo advisor de desempenho do Supabase, e é um achado justo:
--
--      Table `public.books` has multiple permissive policies for role
--      `authenticated` for action `SELECT`.
--      Policies include {books_select_authenticated, books_write_admin}
--
--  A causa é `FOR ALL`. Ele parece significar "todas as operações de escrita",
--  mas significa TODAS as operações — SELECT incluído. Então cada leitura
--  feita por alguém logado avaliava duas policies: a de leitura e, de novo, a
--  de escrita. Numa tabela lida em toda visita à vitrine, é trabalho recorrente
--  em troca de nada.
--
--  E não era só desempenho: a policy de escrita concedendo SELECT deixava a
--  regra de leitura espalhada em dois lugares. Quem fosse conferir "quem
--  enxerga rascunho?" precisava ler as duas e cruzar mentalmente.
--
--  Agora cada comando tem a sua policy. O acesso resultante é EXATAMENTE o
--  mesmo — `books_select_authenticated` já dizia
--  `status = 'published' OR is_admin()`, ou seja, o administrador já lia tudo
--  por ela, e o SELECT herdado do `FOR ALL` nunca liberou nada além disso.
--
--  `catalog_settings` fica só com UPDATE. Ela é uma tabela de UMA linha, criada
--  na migration: não há o que inserir nem o que apagar. O INSERT já era
--  recusado pela ausência de grant (42501, com teste que prova); tirá-lo
--  também da policy faz a intenção aparecer na leitura do arquivo, em vez de
--  depender de alguém notar um grant ausente.
--
--  -----------------------------------------------------------------------------
--  O QUE O ADVISOR APONTA E FICA COMO ESTÁ, DE PROPÓSITO
--  -----------------------------------------------------------------------------
--
--      INFO: catalog_settings.updated_by é uma foreign key sem índice.
--
--  Não indexar é a decisão, e não esquecimento. O motivo de indexar uma FK é o
--  custo de varrer a tabela filha quando a linha PAI é apagada — aqui, quando
--  um usuário sai de `auth.users` e o `ON DELETE SET NULL` precisa achar as
--  linhas que o referenciam.
--
--  `catalog_settings` tem UMA linha, por construção: `id boolean primary key`
--  com `check (id)`. A varredura que o índice evitaria percorre uma linha. O
--  índice custaria mais em escrita e manutenção do que jamais economizaria, e
--  deixaria no schema uma estrutura que só existe para calar um alerta.
--
--  Se um dia a tabela deixar de ser singleton, esta decisão muda junto.
-- =============================================================================

drop policy if exists books_write_admin on public.books;

create policy books_insert_admin on public.books
  for insert to authenticated with check ((select public.is_admin()));
create policy books_update_admin on public.books
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy books_delete_admin on public.books
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists book_localizations_write_admin on public.book_localizations;

create policy book_localizations_insert_admin on public.book_localizations
  for insert to authenticated with check ((select public.is_admin()));
create policy book_localizations_update_admin on public.book_localizations
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy book_localizations_delete_admin on public.book_localizations
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists book_store_links_write_admin on public.book_store_links;

create policy book_store_links_insert_admin on public.book_store_links
  for insert to authenticated with check ((select public.is_admin()));
create policy book_store_links_update_admin on public.book_store_links
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy book_store_links_delete_admin on public.book_store_links
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists catalog_settings_write_admin on public.catalog_settings;

create policy catalog_settings_update_admin on public.catalog_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
