"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const markCompleteSchema = z.object({
  lessonId: z.string().uuid("Aula inválida."),
});

export type ProgressActionState = { error?: string; success?: boolean } | undefined;

const progressCopy = {
  pt: {
    invalid: "Aula inválida.",
    auth: "Sua sessão expirou. Entre novamente.",
    missing: "A aula não foi encontrada.",
    forbidden: "Esta aula ainda não pode ser concluída.",
    failed: "Não foi possível concluir a aula. Tente novamente.",
  },
  en: {
    invalid: "Invalid lesson.",
    auth: "Your session has expired. Log in again.",
    missing: "The lesson was not found.",
    forbidden: "This lesson cannot be completed yet.",
    failed: "We couldn't complete the lesson. Please try again.",
  },
} as const;

/**
 * Conclusão de aula — usada hoje porque nenhuma aula tem vídeo ainda.
 * Quando existir vídeo do YouTube, o player deve chamar esta mesma action a
 * partir do evento `onStateChange` (ENDED) da YouTube IFrame API; a UI
 * muda, a validação não precisa mudar.
 *
 * NÃO grava direto na tabela: chama a função complete_lesson() do banco
 * (security definer), que é o único caminho autorizado a marcar
 * completed=true — RLS bloqueia essa gravação vindo de um insert/update
 * comum (ver a mesma migration). A função valida, nesta ordem: usuário
 * autenticado (auth.uid(), nunca um parâmetro), aula existe, matrícula
 * ativa + curso publicado, aula publicada (nunca draft/coming_soon), aula
 * com vídeo cadastrado, e todas as aulas publicadas anteriores concluídas.
 * Isto é a autoridade de verdade — mesmo que este arquivo tivesse um bug,
 * a função no banco ainda barra.
 */
export async function markLessonCompleteAction(
  _prevState: ProgressActionState,
  formData: FormData,
): Promise<ProgressActionState> {
  // requireStudent e não getAuthContext: concluir aula é operação EXCLUSIVA do
  // aluno. Um administrador chamando esta action registraria progresso no
  // próprio cadastro — dado sujo que depois apareceria no "progresso recente"
  // do painel como se fosse um aluno de verdade.
  const auth = await requireStudent("/aluno");
  const copy = progressCopy[auth.locale];

  const parsed = markCompleteSchema.safeParse({ lessonId: formData.get("lessonId") });
  if (!parsed.success) {
    return { error: copy.invalid };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_lesson", {
    p_lesson_id: parsed.data.lessonId,
  });

  if (error) {
    const message =
      error.code === "28000"
        ? copy.auth
        : error.code === "P0002"
          ? copy.missing
          : error.code === "42501"
            ? copy.forbidden
            : copy.failed;
    return { error: message };
  }

  revalidatePath("/aluno");
  revalidatePath("/aluno/curso/[slug]", "page");
  revalidatePath("/aluno/aula/[lessonId]", "page");

  return { success: true };
}
