"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  atualizarProjetoSchema,
  capituloIdSchema,
  criarCapituloSchema,
  criarProjetoSchema,
  moverCapituloSchema,
  projetoIdSchema,
  salvarCapituloSchema,
} from "@/lib/validation/writing";
import type { WritingChapterRow } from "@/lib/supabase/types";

/**
 * =============================================================================
 *  AÇÕES DO ESTÚDIO DE ESCRITA
 * =============================================================================
 *
 *  Três camadas, e nenhuma delas é dispensável:
 *
 *  1. `requireStudent()` na primeira instrução de toda action. Administrador
 *     não escreve manuscrito de aluno — nem por engano, nem por conveniência.
 *  2. Zod, com os mesmos limites das constraints do banco.
 *  3. RLS, que é quem realmente decide. Todas as consultas usam o cliente
 *     AUTENTICADO. `createAdminClient()` não aparece neste arquivo, e não
 *     deve aparecer: ele ignora RLS, e a RLS é a única coisa que separa o
 *     manuscrito de uma pessoa do de outra.
 *
 *  O `user_id` nunca vem do formulário. Sai de `requireStudent()`, que o lê da
 *  sessão. Nenhuma action aceita "de quem é isso" como entrada.
 */

export type WritingActionState = { error?: string; success?: string } | undefined;

const writingCopy = {
  pt: {
    generic: "Não foi possível salvar agora. Tente de novo em alguns instantes.",
    invalid: "Confira os dados informados e tente novamente.",
    invalidProject: "Projeto inválido.",
    invalidChapter: "Capítulo inválido.",
    invalidMove: "Movimento inválido.",
    invalidContent: "Confira o título e o conteúdo do capítulo.",
    projectCreated: "Projeto criado.",
    projectSaved: "Alterações salvas.",
    projectDeleted: "Projeto excluído.",
    chapterCreated: "Capítulo criado.",
    chapterDeleted: "Capítulo excluído.",
  },
  en: {
    generic: "We couldn't save your changes. Please try again in a moment.",
    invalid: "Check the information provided and try again.",
    invalidProject: "Invalid project.",
    invalidChapter: "Invalid chapter.",
    invalidMove: "Invalid move.",
    invalidContent: "Check the chapter title and content.",
    projectCreated: "Project created.",
    projectSaved: "Changes saved.",
    projectDeleted: "Project deleted.",
    chapterCreated: "Chapter created.",
    chapterDeleted: "Chapter deleted.",
  },
} as const;

/* ------------------------------- projeto ---------------------------------- */

export async function criarProjetoAction(
  _prev: WritingActionState,
  formData: FormData,
): Promise<WritingActionState> {
  const auth = await requireStudent("/aluno/meu-livro");
  const copy = writingCopy[auth.locale];

  const parsed = criarProjetoSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) {
    return { error: copy.invalid };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_writing_project", {
    p_project_title: parsed.data.title,
    p_initial_chapter_title: auth.locale === "en" ? "Chapter 1" : "Capítulo 1",
  });

  if (error || !data) return { error: copy.generic };

  revalidatePath("/aluno/meu-livro");
  revalidatePath("/aluno");
  return { success: copy.projectCreated };
}

export async function atualizarProjetoAction(
  _prev: WritingActionState,
  formData: FormData,
): Promise<WritingActionState> {
  const auth = await requireStudent("/aluno/meu-livro");
  const copy = writingCopy[auth.locale];

  const parsed = atualizarProjetoSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    genre: formData.get("genre") ?? "",
    description: formData.get("description") ?? "",
    wordGoal: formData.get("wordGoal") ?? "",
  });
  if (!parsed.success) {
    return { error: copy.invalid };
  }

  const supabase = await createClient();
  /* `.select()` não é enfeite: um UPDATE que não encontra linha volta SEM
     erro no PostgREST. Sem ele, tentar editar um projeto alheio (a RLS
     esconde, então zero linhas) responderia "salvo". */
  const { data, error } = await supabase
    .from("writing_projects")
    .update({
      title: parsed.data.title,
      genre: parsed.data.genre,
      description: parsed.data.description,
      word_goal: parsed.data.wordGoal,
    })
    .eq("id", parsed.data.projectId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: copy.generic };

  revalidatePath("/aluno/meu-livro");
  return { success: copy.projectSaved };
}

export async function excluirProjetoAction(
  _prev: WritingActionState,
  formData: FormData,
): Promise<WritingActionState> {
  const auth = await requireStudent("/aluno/meu-livro");
  const copy = writingCopy[auth.locale];

  const parsed = projetoIdSchema.safeParse({ projectId: formData.get("projectId") });
  if (!parsed.success) return { error: copy.invalidProject };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("writing_projects")
    .delete()
    .eq("id", parsed.data.projectId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: copy.generic };

  revalidatePath("/aluno/meu-livro");
  revalidatePath("/aluno");
  return { success: copy.projectDeleted };
}

/* ------------------------------- capítulos -------------------------------- */

export async function criarCapituloAction(
  _prev: WritingActionState,
  formData: FormData,
): Promise<WritingActionState> {
  const auth = await requireStudent("/aluno/meu-livro");
  const copy = writingCopy[auth.locale];

  const parsed = criarCapituloSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title") ?? "",
  });
  if (!parsed.success) {
    return { error: copy.invalid };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_writing_chapter", {
    p_project_id: parsed.data.projectId,
    p_title: parsed.data.title,
  });

  if (error || !data) return { error: copy.generic };

  revalidatePath("/aluno/meu-livro");
  return { success: copy.chapterCreated };
}

/**
 * O AUTOSAVE.
 *
 * Chamado com debounce pelo editor. Devolve estado em vez de redirecionar —
 * a tela precisa mostrar "Salvando…", "Salvo" ou o erro sem sair da página.
 *
 * Não faz `revalidatePath`: revalidar a cada pausa de digitação recarregaria
 * a árvore inteira do servidor a cada poucos segundos. A contagem de palavras
 * volta no retorno, e a tela atualiza com ela.
 */
export async function salvarCapituloAction(input: {
  chapterId: string;
  title: string;
  content: string;
}): Promise<{ ok: true; wordCount: number; savedAt: string } | { ok: false; error: string }> {
  const auth = await requireStudent("/aluno/meu-livro");
  const copy = writingCopy[auth.locale];

  const parsed = salvarCapituloSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: copy.invalidContent };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("writing_chapters")
    .update({ title: parsed.data.title, content: parsed.data.content })
    .eq("id", parsed.data.chapterId)
    .select("word_count, updated_at")
    .maybeSingle<Pick<WritingChapterRow, "word_count" | "updated_at">>();

  if (error || !data) return { ok: false, error: copy.generic };

  return { ok: true, wordCount: data.word_count, savedAt: data.updated_at };
}

export async function excluirCapituloAction(
  _prev: WritingActionState,
  formData: FormData,
): Promise<WritingActionState> {
  const auth = await requireStudent("/aluno/meu-livro");
  const copy = writingCopy[auth.locale];

  const parsed = capituloIdSchema.safeParse({ chapterId: formData.get("chapterId") });
  if (!parsed.success) return { error: copy.invalidChapter };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("writing_chapters")
    .delete()
    .eq("id", parsed.data.chapterId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: copy.generic };

  revalidatePath("/aluno/meu-livro");
  return { success: copy.chapterDeleted };
}

/**
 * Reordenar: troca de posição com o vizinho.
 *
 * Três passos com sentinela negativo, igual a `move_lesson` — o unique
 * (project_id, order_index) impede a troca direta. Aqui a constraint é
 * DEFERRABLE, então os passos intermediários passam dentro da transação; o
 * sentinela fica por garantia e legibilidade.
 */
export async function moverCapituloAction(
  _prev: WritingActionState,
  formData: FormData,
): Promise<WritingActionState> {
  const auth = await requireStudent("/aluno/meu-livro");
  const copy = writingCopy[auth.locale];

  const parsed = moverCapituloSchema.safeParse({
    chapterId: formData.get("chapterId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return { error: copy.invalidMove };

  const supabase = await createClient();

  const { error } = await supabase.rpc("move_writing_chapter", {
    p_chapter_id: parsed.data.chapterId,
    p_direction: parsed.data.direction,
  });

  if (error) return { error: copy.generic };

  revalidatePath("/aluno/meu-livro");
  return undefined;
}
