-- =============================================================================
--  BMaxy — operações do catálogo e bucket de capas
-- =============================================================================
--
--  Três coisas que o painel precisa e que não cabem numa consulta solta:
--
--    1. create_book  — criar livro é MAIS DE UM INSERT (o livro e as duas
--                      localizações). Feito da aplicação, seriam duas idas ao
--                      banco com uma janela no meio em que o livro existe sem
--                      sinopse em idioma nenhum.
--    2. move_book    — reordenar é uma troca entre duas linhas com order_index
--                      único. Em transações separadas, uma colide com a outra.
--    3. book-covers  — o limite de tamanho e a lista de formatos aceitos ficam
--                      no BUCKET, não na aplicação: é o único lugar que o
--                      navegador não consegue contornar.
--
--  As duas funções são SECURITY INVOKER, não DEFINER. Elas não precisam
--  escapar da RLS — o administrador já tem as policies de escrita. Ser INVOKER
--  significa que, se um dia alguém conceder EXECUTE a mais gente por engano, a
--  RLS ainda segura. O `if not is_admin() then raise` é a segunda camada, e
--  existe para a chamada falhar com mensagem clara em vez de "0 linhas
--  afetadas", que é indistinguível de "não havia o que mudar".
-- =============================================================================

create or replace function public.create_book(p_slug text, p_title text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_ordem integer;
begin
  if not (select public.is_admin()) then
    raise exception 'apenas administradores criam livros' using errcode = '42501';
  end if;

  -- Serializa criações concorrentes. Sem ele, dois cliques simultâneos leem o
  -- mesmo max(order_index) e o segundo INSERT bate no unique de order_index.
  perform pg_advisory_xact_lock(hashtext('books_order'));

  select coalesce(max(order_index), -1) + 1 into v_ordem from public.books;

  insert into public.books (slug, title, status, order_index)
  values (p_slug, p_title, 'draft', v_ordem)
  returning id into v_id;

  -- As duas localizações nascem junto com o livro. Um livro sem a linha de um
  -- idioma sumiria da vitrine daquele idioma, e criá-las num segundo passo
  -- deixaria uma janela em que isso é verdade.
  insert into public.book_localizations (book_id, locale)
  values (v_id, 'pt'), (v_id, 'en');

  return v_id;
end;
$$;

revoke all on function public.create_book(text, text) from public, anon;
grant execute on function public.create_book(text, text) to authenticated;

create or replace function public.move_book(p_book_id uuid, p_direction text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_atual integer;
  v_vizinho_id uuid;
  v_vizinho_ordem integer;
begin
  if not (select public.is_admin()) then
    raise exception 'apenas administradores reordenam livros' using errcode = '42501';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida' using errcode = '22023';
  end if;

  select order_index into v_atual from public.books where id = p_book_id;
  if v_atual is null then
    return false;
  end if;

  if p_direction = 'up' then
    select id, order_index into v_vizinho_id, v_vizinho_ordem
    from public.books where order_index < v_atual
    order by order_index desc limit 1;
  else
    select id, order_index into v_vizinho_id, v_vizinho_ordem
    from public.books where order_index > v_atual
    order by order_index asc limit 1;
  end if;

  -- Já é o primeiro ou o último. Não é erro: o botão simplesmente não move.
  if v_vizinho_id is null then
    return false;
  end if;

  -- Troca direta, sem sentinela: books_order_unique é DEFERRABLE INITIALLY
  -- DEFERRED, então a duplicidade momentânea entre os dois UPDATEs só seria
  -- verificada no commit — e no commit ela já não existe.
  update public.books set order_index = v_vizinho_ordem where id = p_book_id;
  update public.books set order_index = v_atual where id = v_vizinho_id;

  return true;
end;
$$;

revoke all on function public.move_book(uuid, text) from public, anon;
grant execute on function public.move_book(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
--  Bucket das capas
-- -----------------------------------------------------------------------------
--
--  `allowed_mime_types` SEM 'image/svg+xml', e isso é segurança, não estética.
--  SVG é XML: aceita <script> e handlers de evento, e um SVG servido do mesmo
--  domínio executa no contexto do site. É o formato de imagem que vira XSS.
--  Como a lista está no BUCKET, o Storage recusa no upload — nenhuma validação
--  feita no navegador precisa ser confiável para isso valer.
--
--  `public = true` porque capa de livro é conteúdo de vitrine: o <Image> do
--  Next busca a URL direto, sem sessão. A policy de leitura acompanha. Escrita,
--  atualização e remoção continuam exigindo is_admin().
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-covers',
  'book-covers',
  true,
  5242880,  -- 5 MiB. Uma capa em alta resolução tem ~1 MiB; o teto é folga.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists book_covers_read on storage.objects;
create policy book_covers_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'book-covers');

drop policy if exists book_covers_insert_admin on storage.objects;
create policy book_covers_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'book-covers' and (select public.is_admin()));

drop policy if exists book_covers_update_admin on storage.objects;
create policy book_covers_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'book-covers' and (select public.is_admin()))
  with check (bucket_id = 'book-covers' and (select public.is_admin()));

drop policy if exists book_covers_delete_admin on storage.objects;
create policy book_covers_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'book-covers' and (select public.is_admin()));
