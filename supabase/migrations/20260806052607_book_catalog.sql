-- =============================================================================
--  BMaxy — catálogo de livros administrável
-- =============================================================================
--
--  Hoje os seis livros vivem em `src/content/site.ts`, em duas listas paralelas
--  (pt e en) que precisam ser editadas juntas e publicadas por deploy. Estas
--  tabelas passam a ser a fonte de verdade.
--
--  Nada existente é alterado. Nenhuma tabela antiga é tocada.
--
--  ---------------------------------------------------------------------------
--  DINHEIRO EM CENTAVOS, COTAÇÃO EM NUMERIC
--  ---------------------------------------------------------------------------
--  Preço é `integer` de centavos, nunca `float`/`real`. `0.1 + 0.2` em ponto
--  flutuante binário não dá `0.3`, e um catálogo que erra centavo erra
--  confiança. A cotação é `numeric`, que é decimal exato — não `float`, pelo
--  mesmo motivo.
--
--  O preço em dólar NÃO é armazenado. Ele é derivado de (centavos BRL ÷
--  cotação) na hora de exibir. Guardá-lo criaria dois valores para a mesma
--  verdade, e mudar a cotação exigiria reescrever todos — que é exatamente o
--  problema de hoje, em que "Approx. US$ 14.50" é string fixa no código.
--
--  ---------------------------------------------------------------------------
--  POR QUE TRÊS TABELAS E NÃO UMA
--  ---------------------------------------------------------------------------
--  `books` guarda o que é do LIVRO, independente de idioma: slug, título
--  oficial, preços, capa, ordem, status. O título fica aqui, e não na tabela de
--  idioma, porque é nome próprio — permanece em português mesmo na versão
--  inglesa, por decisão do cliente.
--
--  `book_localizations` guarda o que MUDA por idioma: sinopse e o texto
--  alternativo da capa. Uma coluna `synopsis_pt`/`synopsis_en` em `books`
--  funcionaria hoje e obrigaria um ALTER TABLE no dia do terceiro idioma.
--
--  `book_store_links` guarda as lojas. Uma linha por (livro, loja) em vez de
--  colunas `amazon_url`/`clube_url`: a quarta loja não deveria custar uma
--  migration.
--
--  O RÓTULO DA LOJA NÃO É ARMAZENADO. "Amazon (EUA)" e "Amazon (US)" são
--  função de (loja, idioma), e pedir ao administrador que digite os quatro
--  rótulos a cada livro seria convidar divergência. A aplicação deriva.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. catalog_settings — configuração global do catálogo
-- -----------------------------------------------------------------------------
--
--  Uma linha só, garantida pelo check em `id`. É o truque padrão para
--  "singleton" em SQL: sem ele, nada impede uma segunda linha e a aplicação
--  passa a ter duas cotações e nenhuma forma de saber qual vale.

create table if not exists public.catalog_settings (
  id boolean primary key default true,
  constraint catalog_settings_singleton check (id),

  /* Quantos reais valem um dólar. `numeric(10,4)` porque cotação com duas
     casas já obriga a arredondar antes da conta — e o erro de arredondamento
     entra multiplicado em todos os preços. */
  brl_per_usd numeric(10, 4) not null default 5.1000,
  constraint catalog_settings_rate_sane check (brl_per_usd > 0 and brl_per_usd < 1000),

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.catalog_settings is
  'Linha única. Cotação BRL/USD usada para derivar os precos aproximados do catalogo em ingles.';

insert into public.catalog_settings (id, brl_per_usd)
values (true, 5.1000)
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
--  2. books
-- -----------------------------------------------------------------------------

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),

  /* O slug é a URL pública. `citext` seria melhor, mas exige extensão; a
     constraint abaixo garante minúsculas e o unique cuida do resto. Trocar o
     slug de um livro publicado quebra link externo — a aplicação avisa, e o
     banco só garante que não haja dois iguais. */
  slug text not null unique,
  constraint books_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint books_slug_tamanho check (char_length(slug) between 1 and 120),

  /* Título OFICIAL, em português, inclusive na versão inglesa. Não é campo
     traduzível: é nome de obra. */
  title text not null,
  constraint books_title_tamanho check (char_length(title) between 1 and 200),

  /* draft   — existe no painel, invisível para o público
     published — no ar
     archived  — saiu do ar sem ser apagado. NÃO existe exclusão pela
                 interface: um livro apagado por engano leva junto sinopse,
                 preço, links e a URL que já circula por aí. */
  status text not null default 'draft',
  constraint books_status_valido check (status in ('draft', 'published', 'archived')),

  order_index integer not null default 0,

  /* Preços em CENTAVOS de real. `null` = este formato não tem preço, que é
     diferente de zero — cinco dos seis livros não têm eBook, e "R$ 0,00"
     seria mentira. */
  print_price_cents integer,
  ebook_price_cents integer,
  constraint books_print_price_sane
    check (print_price_cents is null or (print_price_cents > 0 and print_price_cents <= 100000000)),
  constraint books_ebook_price_sane
    check (ebook_price_cents is null or (ebook_price_cents > 0 and ebook_price_cents <= 100000000)),

  /* A capa é um caminho, não um binário. Hoje aponta para /public; quando
     houver upload, aponta para o Storage. As dimensões existem porque
     next/image as exige para reservar espaço e evitar deslocamento de layout. */
  cover_path text not null default '',
  cover_width integer,
  cover_height integer,
  constraint books_cover_dim_sane check (
    (cover_width is null and cover_height is null)
    or (cover_width > 0 and cover_height > 0
        and cover_width <= 10000 and cover_height <= 10000)
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.books is
  'Catalogo de livros. Precos em centavos de BRL; o valor em USD e derivado da cotacao, nunca armazenado.';

/* Ordem estável dentro do catálogo. DEFERRABLE porque a reordenação troca duas
   linhas na mesma transação e passaria por um estado intermediário duplicado. */
alter table public.books drop constraint if exists books_order_unique;
alter table public.books
  add constraint books_order_unique unique (order_index)
  deferrable initially deferred;

create index if not exists books_status_order_idx
  on public.books (status, order_index);


-- -----------------------------------------------------------------------------
--  3. book_localizations
-- -----------------------------------------------------------------------------

create table if not exists public.book_localizations (
  book_id uuid not null references public.books(id) on delete cascade,
  locale text not null,
  constraint book_localizations_locale_valido check (locale in ('pt', 'en')),

  synopsis text not null default '',
  constraint book_localizations_synopsis_tamanho check (char_length(synopsis) <= 4000),

  /* Texto alternativo da capa. Muda por idioma ("Capa do livro X" /
     "Cover of the book X") e é requisito de acessibilidade, não enfeite. */
  cover_alt text not null default '',
  constraint book_localizations_alt_tamanho check (char_length(cover_alt) <= 300),

  updated_at timestamptz not null default now(),

  primary key (book_id, locale)
);


-- -----------------------------------------------------------------------------
--  4. book_store_links
-- -----------------------------------------------------------------------------

create table if not exists public.book_store_links (
  book_id uuid not null references public.books(id) on delete cascade,
  store text not null,
  constraint book_store_links_store_valida check (store in ('amazon', 'clube_de_autores')),

  url text not null,

  /* SOMENTE HTTPS, e somente os domínios das lojas que o cliente usa.
     A validação vive no banco além do formulário porque o formulário protege
     contra engano e o banco protege contra qualquer outro caminho de escrita.
     Um link de loja é conteúdo que o visitante clica — deixá-lo livre é
     conceder redirecionamento aberto a quem tiver o painel. */
  constraint book_store_links_url_https check (url like 'https://%'),
  constraint book_store_links_url_dominio check (
    (store = 'amazon' and url ~ '^https://([a-z0-9-]+\.)*amazon\.(com|com\.br)(/|$)')
    or (store = 'clube_de_autores' and url ~ '^https://([a-z0-9-]+\.)*clubedeautores\.com\.br(/|$)')
  ),
  constraint book_store_links_url_tamanho check (char_length(url) between 12 and 2000),

  updated_at timestamptz not null default now(),

  primary key (book_id, store)
);

comment on table public.book_store_links is
  'Links de loja. O ROTULO nao e armazenado: e derivado de (store, locale) pela aplicacao.';


-- -----------------------------------------------------------------------------
--  5. updated_at por trigger — nunca vindo do cliente
-- -----------------------------------------------------------------------------

create or replace function public.catalog_touch()
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

drop trigger if exists books_touch on public.books;
create trigger books_touch before update on public.books
  for each row execute function public.catalog_touch();

drop trigger if exists book_localizations_touch on public.book_localizations;
create trigger book_localizations_touch before update on public.book_localizations
  for each row execute function public.catalog_touch();

drop trigger if exists book_store_links_touch on public.book_store_links;
create trigger book_store_links_touch before update on public.book_store_links
  for each row execute function public.catalog_touch();

drop trigger if exists catalog_settings_touch on public.catalog_settings;
create trigger catalog_settings_touch before update on public.catalog_settings
  for each row execute function public.catalog_touch();


-- -----------------------------------------------------------------------------
--  6. RLS
-- -----------------------------------------------------------------------------
--
--  A regra, em uma frase: o público lê o que está PUBLICADO; só administrador
--  escreve.
--
--  `anon` recebe SELECT com `status = 'published'`. Sem essa policy o site
--  público deixaria de funcionar; com ela mais frouxa, rascunho e arquivado
--  vazariam pelo PostgREST mesmo sem aparecer na interface.
--
--  Rascunho é conteúdo comercial não anunciado — preço e sinopse de um livro
--  que ainda não saiu.

alter table public.books enable row level security;
alter table public.book_localizations enable row level security;
alter table public.book_store_links enable row level security;
alter table public.catalog_settings enable row level security;

/* ---- leitura pública: só publicado ---- */

create policy books_select_published on public.books
  for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));

/* As tabelas filhas espelham a visibilidade do pai. Sem o EXISTS, a sinopse de
   um rascunho seria legível por quem soubesse o book_id — o livro não
   apareceria na listagem, mas o conteúdo vazaria. */
create policy book_localizations_select_published on public.book_localizations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = book_localizations.book_id
        and (b.status = 'published' or (select public.is_admin()))
    )
  );

create policy book_store_links_select_published on public.book_store_links
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = book_store_links.book_id
        and (b.status = 'published' or (select public.is_admin()))
    )
  );

/* A cotação é pública: ela aparece no rodapé do preço em inglês. Não há nada
   sensível nela, e escondê-la só faria o site precisar de sessão para exibir
   um preço. */
create policy catalog_settings_select_todos on public.catalog_settings
  for select to anon, authenticated
  using (true);

/* ---- escrita: SOMENTE administrador ---- */
--
--  `to authenticated` sozinho significaria "qualquer pessoa logada", o que
--  inclui todo aluno. O que decide é `is_admin()`, que lê public.user_roles
--  pelo auth.uid() — nunca uma role enviada pelo navegador.

create policy books_write_admin on public.books
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy book_localizations_write_admin on public.book_localizations
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy book_store_links_write_admin on public.book_store_links
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy catalog_settings_write_admin on public.catalog_settings
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));


-- -----------------------------------------------------------------------------
--  7. Grants explícitos
-- -----------------------------------------------------------------------------
--
--  RLS decide QUAIS LINHAS; grant decide QUAIS VERBOS. Os dois são necessários:
--  sem o grant, nem o administrador escreve; sem a RLS, o grant deixaria
--  qualquer autenticado escrever qualquer linha.

revoke all on public.books from public, anon, authenticated;
revoke all on public.book_localizations from public, anon, authenticated;
revoke all on public.book_store_links from public, anon, authenticated;
revoke all on public.catalog_settings from public, anon, authenticated;

-- Público: leitura e nada mais.
grant select on public.books to anon, authenticated;
grant select on public.book_localizations to anon, authenticated;
grant select on public.book_store_links to anon, authenticated;
grant select on public.catalog_settings to anon, authenticated;

/* Escrita para `authenticated` — que a RLS restringe a administrador.
   `id`, `created_at` e `updated_at` ficam FORA do grant de UPDATE: id não se
   reescreve, e as datas são do trigger. Tirar o privilégio remove a
   possibilidade antes de a policy precisar julgar. */
grant insert, delete on public.books to authenticated;
grant update (slug, title, status, order_index, print_price_cents,
              ebook_price_cents, cover_path, cover_width, cover_height)
  on public.books to authenticated;

grant insert, delete on public.book_localizations to authenticated;
grant update (synopsis, cover_alt) on public.book_localizations to authenticated;

grant insert, delete on public.book_store_links to authenticated;
grant update (url) on public.book_store_links to authenticated;

grant update (brl_per_usd, updated_by) on public.catalog_settings to authenticated;
