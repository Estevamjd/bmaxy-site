import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDuration,
  lessonState,
  summarizeCourse,
  type ProgressLesson,
} from "../src/lib/dal/course-progress.ts";

/**
 * O que o aluno vê em cada tela. Estes testes existem porque as três telas
 * (painel, curso, aula) já discordaram entre si sobre o mesmo curso, e a
 * origem era cada uma recalcular do seu jeito.
 *
 * A autoridade continua sendo o banco (get_lesson_playback / complete_lesson).
 * Isto aqui garante que a interface diga a mesma coisa que o servidor faria.
 */

const publicada = (id: string, hasVideo = true): ProgressLesson => ({
  id,
  status: "published",
  hasVideo,
  durationSeconds: null,
});

/* ------------------------------ estado da aula ---------------------------- */

test("aula em breve nunca vira disponível, mesmo desbloqueada e com vídeo", () => {
  const emBreve: ProgressLesson = {
    id: "x",
    status: "coming_soon",
    hasVideo: true,
    durationSeconds: null,
  };
  assert.equal(lessonState(emBreve, true, false), "coming_soon");
});

test("aula concluída aparece como concluída antes de qualquer outra coisa", () => {
  assert.equal(lessonState(publicada("a"), true, true), "completed");
});

test("aula publicada e liberada, mas SEM vídeo, não é 'disponível'", () => {
  // Mandar a pessoa para uma tela vazia é pior do que dizer que ainda não há
  // próxima. Este estado existe exatamente para isso.
  assert.equal(lessonState(publicada("a", false), true, false), "no_video");
});

test("aula publicada e não liberada é bloqueada", () => {
  assert.equal(lessonState(publicada("a"), false, false), "locked");
});

/* -------------------------------- resumo ---------------------------------- */

test("aula em breve NÃO conta como publicada", () => {
  // Mostrar "0 de 20" quando 19 sequer estrearam faz o progresso parecer
  // parado por culpa do aluno.
  const curso: ProgressLesson[] = [
    publicada("a1"),
    { id: "a2", status: "coming_soon", hasVideo: false, durationSeconds: null },
    { id: "a3", status: "coming_soon", hasVideo: false, durationSeconds: null },
  ];

  const resumo = summarizeCourse(curso, []);

  assert.equal(resumo.publishedCount, 1);
  assert.equal(resumo.comingSoonCount, 2);
});

test("aula em rascunho não entra em contagem nenhuma", () => {
  const curso: ProgressLesson[] = [
    publicada("a1"),
    { id: "rascunho", status: "draft", hasVideo: true, durationSeconds: null },
  ];

  const resumo = summarizeCourse(curso, []);

  assert.equal(resumo.publishedCount, 1);
  assert.equal(resumo.comingSoonCount, 0);
});

test("progresso conta só as publicadas concluídas", () => {
  const curso = [publicada("a1"), publicada("a2"), publicada("a3"), publicada("a4")];
  const resumo = summarizeCourse(curso, [
    { lessonId: "a1", completed: true },
    { lessonId: "a2", completed: true },
  ]);

  assert.equal(resumo.completedCount, 2);
  assert.equal(resumo.percent, 50);
});

test("curso sem aula publicada não divide por zero", () => {
  const resumo = summarizeCourse([], []);
  assert.equal(resumo.percent, 0);
  assert.equal(resumo.nextLesson, null);
  assert.equal(resumo.nextLessonReason, "empty");
});

/* ------------------------------ próxima aula ------------------------------ */

test("a próxima aula é a primeira publicada que dá para assistir agora", () => {
  const curso = [publicada("a1"), publicada("a2"), publicada("a3")];
  const resumo = summarizeCourse(curso, [{ lessonId: "a1", completed: true }]);

  assert.equal(resumo.nextLesson?.id, "a2");
  assert.equal(resumo.nextLessonReason, "available");
});

test("aula liberada sem vídeo NÃO vira a próxima aula", () => {
  const curso = [publicada("a1", false), publicada("a2")];
  const resumo = summarizeCourse(curso, []);

  assert.equal(resumo.nextLesson, null, "a1 não tem vídeo e a2 está bloqueada por a1");
  assert.notEqual(resumo.nextLessonReason, "available");
});

test("tudo concluído: sem próxima, e o motivo é 'all_completed'", () => {
  const curso = [publicada("a1"), publicada("a2")];
  const resumo = summarizeCourse(curso, [
    { lessonId: "a1", completed: true },
    { lessonId: "a2", completed: true },
  ]);

  assert.equal(resumo.nextLesson, null);
  assert.equal(resumo.nextLessonReason, "all_completed");
  assert.equal(resumo.percent, 100);
});

test("só aulas em breve: sem próxima, e o motivo diz que ainda não estreou", () => {
  const curso: ProgressLesson[] = [
    { id: "a1", status: "coming_soon", hasVideo: false, durationSeconds: null },
  ];
  const resumo = summarizeCourse(curso, []);

  assert.equal(resumo.nextLesson, null);
  assert.equal(resumo.nextLessonReason, "coming_soon");
  // E o estado dela continua sendo "em breve", não "bloqueada".
  assert.equal(resumo.stateById.get("a1"), "coming_soon");
});

test("aula em breve no meio do curso não trava a sequência", () => {
  const curso: ProgressLesson[] = [
    publicada("a1"),
    { id: "a2", status: "coming_soon", hasVideo: false, durationSeconds: null },
    publicada("a3"),
  ];
  const resumo = summarizeCourse(curso, [{ lessonId: "a1", completed: true }]);

  assert.equal(resumo.stateById.get("a3"), "available", "a3 libera com a1 concluída");
  assert.equal(resumo.nextLesson?.id, "a3");
});

test("a sequência atravessa módulos (a lista vem achatada, na ordem do curso)", () => {
  const curso = [publicada("m1a1"), publicada("m2a1")];

  const antes = summarizeCourse(curso, []);
  assert.equal(antes.stateById.get("m2a1"), "locked");

  const depois = summarizeCourse(curso, [{ lessonId: "m1a1", completed: true }]);
  assert.equal(depois.stateById.get("m2a1"), "available");
});

/* -------------------------------- duração --------------------------------- */

test("duração é formatada de forma legível, e ausência é ausência", () => {
  assert.equal(formatDuration(null), null);
  assert.equal(formatDuration(0), null, "zero não é uma duração válida");
  assert.equal(formatDuration(-10), null);
  assert.equal(formatDuration(600), "10 min");
  assert.equal(formatDuration(3600), "1 h");
  assert.equal(formatDuration(3900), "1 h 05");
  assert.equal(formatDuration(7500), "2 h 05");
});
