-- =============================================================================
--  BMaxy — separa as policies de leitura por papel (anon vs authenticated)
-- =============================================================================
--
--  CORREÇÃO DE UM DEFEITO INTRODUZIDO EM 20260806052607.
--
--  Aquela migration criou uma policy só, para os dois papéis:
--
--      using (status = 'published' or (select public.is_admin()))
--
--  Parece inofensivo e QUEBRA O CATÁLOGO PÚBLICO INTEIRO. O papel `anon` não
--  tem EXECUTE em `public.is_admin()` — de propósito, desde
--  20260803203311_harden_rls_and_api_permissions. Ao avaliar a policy, o
--  Postgres tenta chamar a função e aborta a consulta:
--
--      42501 · permission denied for function is_admin
--
--  Não é "o visitante vê menos": é a listagem inteira devolvendo erro. Medido
--  com a chave publicável antes de qualquer interface ser construída em cima.
--
--  A correção é uma policy POR PAPEL. O `anon` nunca avalia `is_admin()`,
--  porque a policy dele não a menciona:
--
--      anon          → status = 'published'
--      authenticated → status = 'published' OR is_admin()
--
--  A alternativa seria conceder EXECUTE de `is_admin()` ao `anon`. Seria pior:
--  ampliaria a superfície pública por causa de uma conveniência de escrita, e
--  a função existe justamente para separar quem é administrador de quem não é.
--
--  As policies de ESCRITA não mudam: elas já são `to authenticated`, e o
--  `anon` nunca chega a avaliá-las.
-- =============================================================================

drop policy if exists books_select_published on public.books;
drop policy if exists book_localizations_select_published on public.book_localizations;
drop policy if exists book_store_links_select_published on public.book_store_links;

create policy books_select_anon on public.books
  for select to anon
  using (status = 'published');

create policy books_select_authenticated on public.books
  for select to authenticated
  using (status = 'published' or (select public.is_admin()));

-- As tabelas filhas espelham a visibilidade do pai. Sem o EXISTS, a sinopse de
-- um rascunho seria legível por quem soubesse o book_id.
create policy book_localizations_select_anon on public.book_localizations
  for select to anon
  using (
    exists (
      select 1 from public.books b
      where b.id = book_localizations.book_id and b.status = 'published'
    )
  );

create policy book_localizations_select_authenticated on public.book_localizations
  for select to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = book_localizations.book_id
        and (b.status = 'published' or (select public.is_admin()))
    )
  );

create policy book_store_links_select_anon on public.book_store_links
  for select to anon
  using (
    exists (
      select 1 from public.books b
      where b.id = book_store_links.book_id and b.status = 'published'
    )
  );

create policy book_store_links_select_authenticated on public.book_store_links
  for select to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = book_store_links.book_id
        and (b.status = 'published' or (select public.is_admin()))
    )
  );
