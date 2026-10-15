-- =============================================================================
--  BMaxy — os seis livros existentes migram para o catálogo administrável
-- =============================================================================
--
--  Gerado a partir de `src/content/site.ts`, não digitado à mão: slug, título,
--  ordem, sinopses pt/en, texto alternativo da capa, dimensões, preços e links
--  saem exatamente de onde o site os lê hoje.
--
--  Preços convertidos para CENTAVOS: R$ 73,92 -> 7392. `null` onde não há
--  preço — quatro livros não têm eBook e um não tem preço nenhum. `null` é
--  diferente de zero, e "R$ 0,00" seria mentira.
--
--  Todos entram como `published`: é o estado em que já estão no ar.
-- =============================================================================

insert into public.books (slug,title,status,order_index,print_price_cents,ebook_price_cents,cover_path,cover_width,cover_height) values ('aaron-tucker','Aaron Tucker','published',0,7392,3550,'/livros/aaron-tucker.jpg',1654,2480);
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'pt','Suspense psicológico. Um homem comum, uma escolha que não dá para desfazer e a lenta descoberta de quem ele sempre foi.','Capa do livro Aaron Tucker' from public.books where slug='aaron-tucker';
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'en','Psychological suspense. An ordinary man, a choice he can''t undo, and the slow discovery of who he always was.','Cover of the book Aaron Tucker' from public.books where slug='aaron-tucker';
insert into public.book_store_links (book_id,store,url) select id,'amazon','https://www.amazon.com/dp/B0H2ZD5S7M' from public.books where slug='aaron-tucker';
insert into public.book_store_links (book_id,store,url) select id,'clube_de_autores','https://clubedeautores.com.br/livro/aaron-tucker' from public.books where slug='aaron-tucker';
insert into public.books (slug,title,status,order_index,print_price_cents,ebook_price_cents,cover_path,cover_width,cover_height) values ('devagar-tambem-e-pressa','Devagar também é pressa','published',1,9647,null,'/livros/devagar-tambem-e-pressa.jpg',1654,2480);
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'pt','Um convite para pausar em meio ao caos: reflexões curtas que não cobram, não pressionam, apenas aliviam quem carrega peso demais.','Capa do livro Devagar também é pressa' from public.books where slug='devagar-tambem-e-pressa';
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'en','An invitation to pause in the middle of the chaos: short reflections that don''t demand or pressure — they just ease the load for anyone carrying too much.','Cover of the book Devagar também é pressa' from public.books where slug='devagar-tambem-e-pressa';
insert into public.book_store_links (book_id,store,url) select id,'amazon','https://www.amazon.com/dp/B0H34C5ZML' from public.books where slug='devagar-tambem-e-pressa';
insert into public.book_store_links (book_id,store,url) select id,'clube_de_autores','https://clubedeautores.com.br/livro/devagar-tambem-e-pressa' from public.books where slug='devagar-tambem-e-pressa';
insert into public.books (slug,title,status,order_index,print_price_cents,ebook_price_cents,cover_path,cover_width,cover_height) values ('5-passos-importantes-para-prosperar','5 Passos importantes para prosperar','published',2,6439,null,'/livros/5-passos-importantes-para-prosperar.jpg',1654,2480);
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'pt','Guia direto e provocador para romper os padrões que sabotam a prosperidade — com responsabilidade, disciplina e método, sem fórmula mágica.','Capa do livro 5 Passos importantes para prosperar' from public.books where slug='5-passos-importantes-para-prosperar';
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'en','A direct, provocative guide to breaking the patterns that sabotage prosperity — through responsibility, discipline, and method, with no magic formula.','Cover of the book 5 Passos importantes para prosperar' from public.books where slug='5-passos-importantes-para-prosperar';
insert into public.book_store_links (book_id,store,url) select id,'amazon','https://www.amazon.com/dp/B0GHFVMPK9' from public.books where slug='5-passos-importantes-para-prosperar';
insert into public.book_store_links (book_id,store,url) select id,'clube_de_autores','https://clubedeautores.com.br/livro/5-passos-importantespara-prosperar' from public.books where slug='5-passos-importantes-para-prosperar';
insert into public.books (slug,title,status,order_index,print_price_cents,ebook_price_cents,cover_path,cover_width,cover_height) values ('e-se-eu-fosse-embora','E se eu fosse embora?','published',3,10229,null,'/livros/e-se-eu-fosse-embora.jpg',1654,2480);
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'pt','Drama humano sobre escolhas e sobre o que fica para quem permanece quando alguém decide partir.','Capa do livro E se eu fosse embora?' from public.books where slug='e-se-eu-fosse-embora';
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'en','Human drama about choices, and about what''s left for the people who stay when someone decides to leave.','Cover of the book E se eu fosse embora?' from public.books where slug='e-se-eu-fosse-embora';
insert into public.book_store_links (book_id,store,url) select id,'amazon','https://www.amazon.com/dp/B0G1YZB2C2' from public.books where slug='e-se-eu-fosse-embora';
insert into public.book_store_links (book_id,store,url) select id,'clube_de_autores','https://clubedeautores.com.br/livro/e-se-eu-fosse-embora' from public.books where slug='e-se-eu-fosse-embora';
insert into public.books (slug,title,status,order_index,print_price_cents,ebook_price_cents,cover_path,cover_width,cover_height) values ('minha-beagle-luna','Minha Beagle Luna','published',4,8933,2956,'/livros/minha-beagle-luna.jpg',1654,2480);
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'pt','A convivência que ensinou mais sobre presença e afeto do que qualquer livro que eu tinha lido até ali.','Capa do livro Minha Beagle Luna' from public.books where slug='minha-beagle-luna';
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'en','The companionship that taught more about presence and affection than any book I''d read before.','Cover of the book Minha Beagle Luna' from public.books where slug='minha-beagle-luna';
insert into public.book_store_links (book_id,store,url) select id,'amazon','https://www.amazon.com/dp/B0G1V5XKTH' from public.books where slug='minha-beagle-luna';
insert into public.book_store_links (book_id,store,url) select id,'clube_de_autores','https://clubedeautores.com.br/livro/minha-beagle-luna' from public.books where slug='minha-beagle-luna';
insert into public.books (slug,title,status,order_index,print_price_cents,ebook_price_cents,cover_path,cover_width,cover_height) values ('respeito-de-daniel','Respeito de Daniel','published',5,null,null,'/livros/respeito-de-daniel.jpg',1654,2480);
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'pt','Drama sobre relações, limites e o tempo que leva até um pai e um filho aprenderem a se ouvir.','Capa do livro Respeito de Daniel' from public.books where slug='respeito-de-daniel';
insert into public.book_localizations (book_id,locale,synopsis,cover_alt) select id,'en','A drama about relationships, boundaries, and the time it takes for a father and son to learn to listen to each other.','Cover of the book Respeito de Daniel' from public.books where slug='respeito-de-daniel';
insert into public.book_store_links (book_id,store,url) select id,'amazon','https://www.amazon.com/dp/B0DJGN3Z35' from public.books where slug='respeito-de-daniel';
insert into public.book_store_links (book_id,store,url) select id,'clube_de_autores','https://clubedeautores.com.br/livro/respeito-de-daniel' from public.books where slug='respeito-de-daniel';
