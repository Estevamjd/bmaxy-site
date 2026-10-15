import { computeLessonUnlockMap, type LessonCompletion } from "@/lib/dal/lesson-unlock";
import type { LessonStatus } from "@/lib/supabase/types";

/**
 * =============================================================================
 *  QUEM PODE VER O VÍDEO, E QUEM PODE CONCLUIR A AULA
 * =============================================================================
 *
 *  Módulo puro de propósito — sem "server-only", sem Supabase, sem I/O. Só
 *  decide, a partir do que recebe. Isso permite testar as regras sem subir
 *  banco nenhum (ver tests/lesson-playback.test.mts).
 *
 *  ESTA NÃO É A AUTORIDADE. A autoridade são as funções
 *  `get_lesson_playback()` e `complete_lesson()` no Postgres
 *  (supabase/migrations/20260803202703_private_lesson_media.sql), que rodam
 *  com os dados reais e não podem ser contornadas por um bug daqui nem por
 *  alguém chamando a API do Supabase direto. O que este arquivo faz é a
 *  primeira barreira: evitar a ida ao banco quando já sabemos que a resposta
 *  é não, e manter a interface coerente com o que o banco vai responder.
 *
 *  As duas camadas aplicam a MESMA regra. Se a regra mudar, mude nos dois
 *  lugares — e o teste que compara as mensagens existe para lembrar disso.
 * =========================================================================== */

export type GateLesson = {
  id: string;
  status: LessonStatus;
  /** Existe mídia cadastrada? Vem de lessons.has_video — nunca o id do vídeo. */
  hasVideo: boolean;
};

export type PlaybackDenial =
  /** Aula anterior ainda não concluída. */
  | "locked"
  /** draft ou coming_soon — não estreou. */
  | "not_published"
  /** Publicada, mas ninguém cadastrou vídeo ainda. */
  | "no_video";

export type PlaybackDecision =
  | { allowed: true }
  | { allowed: false; reason: PlaybackDenial };

/**
 * Vale a pena pedir o vídeo desta aula ao banco?
 *
 * A ordem das checagens importa e é a mesma de get_lesson_playback(): status
 * antes de sequência antes de mídia. Assim a mensagem que a pessoa vê é a
 * mesma que o banco daria se ela burlasse a interface.
 *
 * `unlocked` vem de computeLessonUnlockMap, que marca aula `coming_soon` como
 * "liberada" — ela aparece na lista, com o aviso de em breve. Por isso o
 * status é conferido aqui de novo: "aparece na lista" e "entrega o vídeo" são
 * perguntas diferentes.
 */
export function canRequestPlayback(
  lesson: GateLesson,
  unlocked: boolean,
): PlaybackDecision {
  if (lesson.status !== "published") return { allowed: false, reason: "not_published" };
  if (!unlocked) return { allowed: false, reason: "locked" };
  if (!lesson.hasVideo) return { allowed: false, reason: "no_video" };
  return { allowed: true };
}

export type CompletionDenial = PlaybackDenial | "unknown_lesson";

export type CompletionDecision =
  | { allowed: true }
  | { allowed: false; reason: CompletionDenial };

/**
 * Esta aula pode ser marcada como concluída agora?
 *
 * Calcula a sequência a partir do curso INTEIRO (`orderedLessons` precisa vir
 * na ordem real: módulo primeiro, aula dentro do módulo depois), e não a
 * partir da aula isolada — uma aula no meio do curso só conclui se todas as
 * publicadas anteriores já estiverem concluídas, inclusive as de módulos
 * anteriores.
 */
export function canCompleteLesson(
  orderedLessons: GateLesson[],
  progress: LessonCompletion[],
  lessonId: string,
): CompletionDecision {
  const lesson = orderedLessons.find((l) => l.id === lessonId);
  if (!lesson) return { allowed: false, reason: "unknown_lesson" };

  const unlockMap = computeLessonUnlockMap(orderedLessons, progress);
  return canRequestPlayback(lesson, unlockMap.get(lessonId) ?? false);
}
