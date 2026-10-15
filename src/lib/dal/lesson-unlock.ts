import type { LessonStatus } from "@/lib/supabase/types";

/**
 * Módulo puro de propósito — nenhum import de "server-only", Supabase ou
 * Next.js. computeLessonUnlockMap() não faz I/O nenhum, só calcula a partir
 * do que recebe, então pode ser testado direto com `node`, sem subir a app
 * nem um banco. Ver src/lib/dal/__tests__/lesson-unlock.test.ts.
 */

export type UnlockableLesson = { id: string; status: LessonStatus };
export type LessonCompletion = { lessonId: string; completed: boolean };

/**
 * Regra de desbloqueio sequencial: a primeira aula PUBLICADA da lista
 * sempre está liberada; cada aula publicada seguinte só libera quando a
 * publicada anterior estiver concluída. Aulas "coming_soon" nunca travam
 * nada (não têm vídeo pra concluir) e aparecem sempre como "em breve" —
 * elas não entram na corrente de bloqueio. Aulas "draft" nem chegam aqui
 * (RLS já as esconde) — se vierem mesmo assim, são ignoradas.
 *
 * `orderedLessons` PRECISA vir na ordem certa do curso inteiro (módulo,
 * depois aula dentro do módulo) — esta função não reordena nada, só
 * percorre a lista na ordem recebida. Mesma regra usada em
 * complete_lesson() no banco (supabase/migrations/20260803202701_secure_lesson_completion.sql).
 */
export function computeLessonUnlockMap(
  orderedLessons: UnlockableLesson[],
  progress: LessonCompletion[],
): Map<string, boolean> {
  const completedByLessonId = new Map(progress.map((p) => [p.lessonId, p.completed]));
  const unlocked = new Map<string, boolean>();

  // `chainIntact` só continua true se TODA aula publicada até aqui estava,
  // ela mesma, liberada E concluída — não basta a aula anterior estar
  // marcada como concluída isoladamente. Sem isso, uma linha de progresso
  // "fora de ordem" (ex.: aula 3 concluída sem a 1 e a 2, que
  // complete_lesson() no banco não deveria permitir, mas que uma migração
  // antiga ou um dado corrompido poderiam produzir) destravava tudo que
  // vinha depois dela, mesmo com a corrente real quebrada mais cedo.
  let chainIntact: boolean = true;

  for (const lesson of orderedLessons) {
    if (lesson.status === "coming_soon") {
      unlocked.set(lesson.id, true);
      continue;
    }
    if (lesson.status !== "published") continue;

    const isUnlocked: boolean = chainIntact;
    unlocked.set(lesson.id, isUnlocked);

    const isCompleted: boolean = completedByLessonId.get(lesson.id) === true;
    chainIntact = isUnlocked && isCompleted;
  }

  return unlocked;
}
