import assert from "node:assert/strict";
import test from "node:test";
import {
  canCompleteLesson,
  canRequestPlayback,
  type GateLesson,
} from "../src/lib/dal/lesson-playback.ts";
import { computeLessonUnlockMap } from "../src/lib/dal/lesson-unlock.ts";

/**
 * A regra de quem pode ver o vídeo e quem pode concluir a aula.
 *
 * Estes testes cobrem a PRIMEIRA barreira (a da aplicação). A segunda — as
 * funções get_lesson_playback() e complete_lesson() no Postgres — só pode ser
 * verificada contra um Supabase real, porque depende de auth.uid() e de RLS;
 * o roteiro está em docs/QA-CHECKLIST.md. As duas aplicam a mesma regra de
 * propósito, e é por isso que vale testar esta aqui: se ela divergir da do
 * banco, a interface começa a prometer o que o servidor nega.
 */

const CURSO: GateLesson[] = [
  { id: "a1", status: "published", hasVideo: true },
  { id: "a2", status: "published", hasVideo: true },
  { id: "a3", status: "published", hasVideo: true },
];

/** Atalho: o que o mapa de desbloqueio diz sobre uma aula, dado o progresso. */
function liberada(lessons: GateLesson[], progresso: { lessonId: string; completed: boolean }[], id: string) {
  return computeLessonUnlockMap(lessons, progresso).get(id) ?? false;
}

/* ------------------------- aula bloqueada NÃO recebe vídeo ------------------ */

test("aula bloqueada pela sequência não recebe dado de reprodução", () => {
  // Ninguém concluiu nada: só a aula 1 está liberada.
  const progresso: { lessonId: string; completed: boolean }[] = [];

  const decisao = canRequestPlayback(CURSO[1], liberada(CURSO, progresso, "a2"));

  assert.equal(decisao.allowed, false);
  assert.equal(decisao.allowed === false && decisao.reason, "locked");
});

test("aula muito à frente continua bloqueada mesmo com a anterior imediata concluída fora de ordem", () => {
  // a2 marcada como concluída sem a a1 — dado inconsistente que o banco não
  // deveria produzir, mas que uma migração antiga ou um insert manual
  // poderiam. A corrente continua quebrada em a1, então a3 NÃO libera.
  const progresso = [{ lessonId: "a2", completed: true }];

  const decisao = canRequestPlayback(CURSO[2], liberada(CURSO, progresso, "a3"));

  assert.equal(decisao.allowed, false);
  assert.equal(decisao.allowed === false && decisao.reason, "locked");
});

test("aula coming_soon nunca entrega vídeo, mesmo com mídia cadastrada e desbloqueada", () => {
  const emBreve: GateLesson = { id: "x", status: "coming_soon", hasVideo: true };

  // computeLessonUnlockMap marca coming_soon como "liberada" — ela aparece na
  // lista com o aviso de estreia. Aparecer na lista e entregar o vídeo são
  // perguntas diferentes, e é exatamente isso que este teste protege.
  const decisao = canRequestPlayback(emBreve, true);

  assert.equal(decisao.allowed, false);
  assert.equal(decisao.allowed === false && decisao.reason, "not_published");
});

test("aula draft não entrega vídeo", () => {
  const rascunho: GateLesson = { id: "x", status: "draft", hasVideo: true };
  const decisao = canRequestPlayback(rascunho, true);

  assert.equal(decisao.allowed, false);
  assert.equal(decisao.allowed === false && decisao.reason, "not_published");
});

/* -------------------------- aula liberada RECEBE o dado -------------------- */

test("primeira aula publicada recebe o dado de reprodução sem depender de progresso", () => {
  const decisao = canRequestPlayback(CURSO[0], liberada(CURSO, [], "a1"));
  assert.equal(decisao.allowed, true);
});

test("aula 2 recebe o dado de reprodução depois que a aula 1 é concluída", () => {
  const progresso = [{ lessonId: "a1", completed: true }];

  const antes = canRequestPlayback(CURSO[1], liberada(CURSO, [], "a2"));
  const depois = canRequestPlayback(CURSO[1], liberada(CURSO, progresso, "a2"));

  assert.equal(antes.allowed, false);
  assert.equal(depois.allowed, true);
});

test("aula publicada e desbloqueada, mas sem mídia cadastrada, não vira player", () => {
  const semVideo: GateLesson = { id: "a1", status: "published", hasVideo: false };
  const decisao = canRequestPlayback(semVideo, true);

  assert.equal(decisao.allowed, false);
  assert.equal(decisao.allowed === false && decisao.reason, "no_video");
});

/* ------------------- conclusão fora de sequência é rejeitada --------------- */

test("concluir a aula 3 sem ter concluído a 1 e a 2 é rejeitado", () => {
  const decisao = canCompleteLesson(CURSO, [], "a3");

  assert.equal(decisao.allowed, false);
  assert.equal(decisao.allowed === false && decisao.reason, "locked");
});

test("concluir a aula 2 sem a 1 é rejeitado; com a 1 concluída, é aceito", () => {
  const semA1 = canCompleteLesson(CURSO, [], "a2");
  const comA1 = canCompleteLesson(CURSO, [{ lessonId: "a1", completed: true }], "a2");

  assert.equal(semA1.allowed, false);
  assert.equal(semA1.allowed === false && semA1.reason, "locked");
  assert.equal(comA1.allowed, true);
});

test("a sequência atravessa módulos: aula do módulo 2 espera a do módulo 1", () => {
  // `orderedLessons` já vem na ordem real do curso (módulo, depois aula
  // dentro do módulo). m1a1 é a única liberada de saída.
  const doisModulos: GateLesson[] = [
    { id: "m1a1", status: "published", hasVideo: true },
    { id: "m2a1", status: "published", hasVideo: true },
  ];

  const antes = canCompleteLesson(doisModulos, [], "m2a1");
  const depois = canCompleteLesson(doisModulos, [{ lessonId: "m1a1", completed: true }], "m2a1");

  assert.equal(antes.allowed, false);
  assert.equal(depois.allowed, true);
});

test("concluir aula que não pertence ao curso carregado é rejeitado", () => {
  const decisao = canCompleteLesson(CURSO, [], "de-outro-curso");

  assert.equal(decisao.allowed, false);
  assert.equal(decisao.allowed === false && decisao.reason, "unknown_lesson");
});

test("aula coming_soon não pode ser concluída", () => {
  const comEmBreve: GateLesson[] = [
    { id: "a1", status: "published", hasVideo: true },
    { id: "a2", status: "coming_soon", hasVideo: false },
  ];

  const decisao = canCompleteLesson(comEmBreve, [{ lessonId: "a1", completed: true }], "a2");

  assert.equal(decisao.allowed, false);
  assert.equal(decisao.allowed === false && decisao.reason, "not_published");
});
