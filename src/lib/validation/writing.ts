import { z } from "zod";

/**
 * Validação do Estúdio de Escrita.
 *
 * Os limites aqui são os MESMOS das constraints do banco
 * (`20260805082832_writing_studio.sql`). Repetição deliberada: o Zod dá a
 * mensagem em português na tela, e o Postgres é quem realmente impede. Se um
 * dos dois mudar, o outro precisa mudar junto — e a divergência aparece como
 * um erro 23514 cru na interface, que é o sintoma de que alguém esqueceu.
 */

/** 200 caracteres — `writing_projects_title_len` / `writing_chapters_title_len`. */
const TITULO_MAX = 200;
/** 2000 — `writing_projects_description_len`. */
const DESCRICAO_MAX = 2000;
/** 80 — `writing_projects_genre_len`. */
const GENERO_MAX = 80;
/** 2 MB — `writing_chapters_content_len`. */
const CONTEUDO_MAX = 2_000_000;
/** 5 milhões — `writing_projects_word_goal_sane`. */
const META_MAX = 5_000_000;

export const criarProjetoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Dê um título ao seu livro. Pode ser provisório.")
    .max(TITULO_MAX, `O título precisa ter no máximo ${TITULO_MAX} caracteres.`),
});

export const atualizarProjetoSchema = z.object({
  projectId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(1, "O título não pode ficar vazio.")
    .max(TITULO_MAX, `O título precisa ter no máximo ${TITULO_MAX} caracteres.`),
  genre: z
    .string()
    .trim()
    .max(GENERO_MAX, `O gênero precisa ter no máximo ${GENERO_MAX} caracteres.`),
  description: z
    .string()
    .trim()
    .max(DESCRICAO_MAX, `A descrição precisa ter no máximo ${DESCRICAO_MAX} caracteres.`),
  /* Meta vazia é AUSÊNCIA de meta, não zero. O campo do formulário chega como
     string vazia quando ninguém digitou nada, e `null` é o que o banco
     entende por "sem meta". */
  wordGoal: z
    .union([z.literal(""), z.coerce.number().int().positive().max(META_MAX)])
    .transform((valor) => (valor === "" ? null : valor)),
});

export const projetoIdSchema = z.object({
  projectId: z.string().uuid(),
});

export const criarCapituloSchema = z.object({
  projectId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .max(TITULO_MAX, `O título precisa ter no máximo ${TITULO_MAX} caracteres.`),
});

export const salvarCapituloSchema = z.object({
  chapterId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .max(TITULO_MAX, `O título precisa ter no máximo ${TITULO_MAX} caracteres.`),
  /* O conteúdo NÃO leva `.trim()`: espaço e quebra de linha no fim são
     decisões de quem escreve, e o autosave não pode reescrever o texto da
     pessoa pelas costas enquanto ela digita. */
  content: z
    .string()
    .max(CONTEUDO_MAX, "Este capítulo ficou grande demais. Divida-o em dois."),
});

export const capituloIdSchema = z.object({
  chapterId: z.string().uuid(),
});

export const moverCapituloSchema = z.object({
  chapterId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export type CriarProjetoInput = z.infer<typeof criarProjetoSchema>;
export type SalvarCapituloInput = z.infer<typeof salvarCapituloSchema>;
