-- =============================================================================
-- Seed de desenvolvimento — só conteúdo de curso (nenhum usuário: contas de
-- Auth não se criam por SQL bruto, ver docs/SETUP-MVP.md para o admin e o
-- aluno de demonstração).
--
-- Idempotente: rodar mais de uma vez não duplica nada (ON CONFLICT usa as
-- constraints únicas da migration inicial).
-- =============================================================================

insert into public.courses (slug, title_pt, title_en, description_pt, description_en, status)
values (
  'seu-livro',
  'Seu Livro',
  'Write Your Book',
  'Aulas em vídeo para tirar o livro da cabeça e colocá-lo no mundo. Do primeiro rascunho à publicação.',
  'Video lessons to get the book out of your head and into the world. From the first draft to publication.',
  'published'
)
on conflict (slug) do update set
  title_pt = excluded.title_pt,
  title_en = excluded.title_en,
  description_pt = excluded.description_pt,
  description_en = excluded.description_en;

insert into public.course_modules (course_id, title_pt, title_en, order_index)
select c.id, 'Comece aqui', 'Start here', 0
from public.courses c
where c.slug = 'seu-livro'
on conflict (course_id, order_index) do update set
  title_pt = excluded.title_pt,
  title_en = excluded.title_en;

-- Aula 1: título e status reais, sem vídeo (nenhum vídeo foi aprovado ainda
-- — ver o mesmo cuidado já tomado na landing page). Não inventar outras
-- aulas: só a 1 existe até o cliente aprovar mais conteúdo.
--
-- video_provider/video_id NÃO entram mais aqui: saíram de public.lessons na
-- migration 20260803202703_private_lesson_media.sql e passaram a viver em
-- public.lesson_media, que não é legível pela API. Para cadastrar um vídeo,
-- insira em lesson_media (o trigger acerta lessons.has_video sozinho) — pelo
-- painel administrativo ou, em desenvolvimento, com a service_role.
insert into public.lessons (
  module_id, title_pt, title_en, description_pt, description_en,
  order_index, status, is_preview
)
select
  m.id,
  'Por que o seu livro ainda não existe',
  'Why your book doesn''t exist yet',
  '',
  '',
  0,
  'coming_soon',
  true
from public.course_modules m
join public.courses c on c.id = m.course_id
where c.slug = 'seu-livro' and m.order_index = 0
on conflict (module_id, order_index) do update set
  title_pt = excluded.title_pt,
  title_en = excluded.title_en,
  status = excluded.status;
