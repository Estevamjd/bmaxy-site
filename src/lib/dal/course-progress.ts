import { computeLessonUnlockMap, type LessonCompletion } from "@/lib/dal/lesson-unlock";
import type { LessonStatus } from "@/lib/supabase/types";

/**
 * =============================================================================
 *  O ESTADO DE CADA AULA E O RESUMO DE UM CURSO
 * =============================================================================
 *
 *  Módulo puro — sem "server-only", sem Supabase, sem I/O. Existe porque as
 *  três telas do aluno (painel, curso, aula) precisam responder às MESMAS
 *  perguntas: quantas aulas contam, quantas foram concluídas, qual é a
 *  próxima, e em que estado está cada uma. Antes cada tela recalculava isso do
 *  seu jeito, e elas discordavam entre si.
 *
 *  Continua valendo: o desbloqueio de verdade é decidido no banco
 *  (`get_lesson_playback()` e `complete_lesson()`). Isto aqui é o que a
 *  interface mostra, e é feito para bater com aquilo.
 * =========================================================================== */

export type ProgressLesson = {
  id: string;
  status: LessonStatus;
  hasVideo: boolean;
  durationSeconds: number | null;
};

/**
 * - `completed`: já concluída.
 * - `available`: liberada e pronta para assistir.
 * - `locked`: publicada, mas a corrente anterior não fechou.
 * - `coming_soon`: anunciada, sem estreia — não bloqueia nem conta como
 *   publicada.
 * - `no_video`: publicada e liberada, mas ninguém cadastrou o vídeo. É um
 *   problema de bastidor que o aluno não deveria ver como "disponível".
 */
export type LessonState = "completed" | "available" | "locked" | "coming_soon" | "no_video";

export function lessonState(
  lesson: ProgressLesson,
  unlocked: boolean,
  completed: boolean,
): LessonState {
  if (lesson.status === "coming_soon") return "coming_soon";
  if (completed) return "completed";
  if (!unlocked) return "locked";
  if (!lesson.hasVideo) return "no_video";
  return "available";
}

export type CourseSummary = {
  /**
   * Só aulas `published` contam. Uma aula "em breve" NÃO entra: mostrar
   * "0 de 20" quando 19 sequer estrearam faz o progresso parecer parado por
   * culpa do aluno.
   */
  publishedCount: number;
  completedCount: number;
  comingSoonCount: number;
  percent: number;
  /** Onde o botão "Continuar aprendendo" deve levar. null se não há para onde. */
  nextLesson: ProgressLesson | null;
  /** Por que não há próxima aula — o que a tela precisa explicar. */
  nextLessonReason: "available" | "all_completed" | "coming_soon" | "empty";
  stateById: Map<string, LessonState>;
};

/**
 * `orderedLessons` PRECISA vir na ordem real do curso (módulo, depois aula
 * dentro do módulo) — a sequência depende disso e esta função não reordena.
 */
export function summarizeCourse(
  orderedLessons: ProgressLesson[],
  progress: LessonCompletion[],
): CourseSummary {
  const unlockMap = computeLessonUnlockMap(orderedLessons, progress);
  const completedIds = new Set(progress.filter((p) => p.completed).map((p) => p.lessonId));

  const stateById = new Map<string, LessonState>();
  for (const lesson of orderedLessons) {
    stateById.set(
      lesson.id,
      lessonState(lesson, unlockMap.get(lesson.id) ?? false, completedIds.has(lesson.id)),
    );
  }

  const published = orderedLessons.filter((l) => l.status === "published");
  const completedCount = published.filter((l) => completedIds.has(l.id)).length;
  const comingSoonCount = orderedLessons.filter((l) => l.status === "coming_soon").length;

  // A próxima é a primeira publicada que dá para assistir agora. "Dá para
  // assistir" inclui ter vídeo: mandar a pessoa para uma aula liberada e vazia
  // é pior do que dizer que ainda não há próxima.
  const nextLesson = published.find((l) => stateById.get(l.id) === "available") ?? null;

  let nextLessonReason: CourseSummary["nextLessonReason"];
  if (nextLesson) nextLessonReason = "available";
  else if (published.length === 0) nextLessonReason = comingSoonCount > 0 ? "coming_soon" : "empty";
  else if (completedCount === published.length) nextLessonReason = "all_completed";
  else nextLessonReason = "coming_soon";

  return {
    publishedCount: published.length,
    completedCount,
    comingSoonCount,
    percent: published.length === 0 ? 0 : Math.round((completedCount / published.length) * 100),
    nextLesson,
    nextLessonReason,
    stateById,
  };
}

/** "12 min", "1 h 05" — null quando a duração não foi cadastrada. */
export function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")}`;
}
