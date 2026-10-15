-- Remove a contagem de aulas que não foi aprovada pelo cliente. O texto fica
-- alinhado ao conteúdo público centralizado, nos dois idiomas.
update public.courses
set
  description_pt = 'Aulas em vídeo para tirar o livro da cabeça e colocá-lo no mundo. Do primeiro rascunho à publicação.',
  description_en = 'Video lessons to get the book out of your head and into the world. From the first draft to publication.',
  updated_at = now()
where slug = 'seu-livro';
