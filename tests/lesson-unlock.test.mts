import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLessonUnlockMap } from "../src/lib/dal/lesson-unlock.ts";

test("primeira aula publicada fica disponível mesmo sem nenhum progresso", () => {
  const lessons = [{ id: "l1", status: "published" as const }];
  const map = computeLessonUnlockMap(lessons, []);
  assert.equal(map.get("l1"), true);
});

test("aula 2 fica bloqueada enquanto a aula 1 não estiver concluída", () => {
  const lessons = [
    { id: "l1", status: "published" as const },
    { id: "l2", status: "published" as const },
  ];
  const map = computeLessonUnlockMap(lessons, []);
  assert.equal(map.get("l1"), true, "aula 1 sempre liberada");
  assert.equal(map.get("l2"), false, "aula 2 bloqueada sem a 1 concluída");
});

test("aula 2 libera depois que a aula 1 é concluída", () => {
  const lessons = [
    { id: "l1", status: "published" as const },
    { id: "l2", status: "published" as const },
  ];
  const map = computeLessonUnlockMap(lessons, [{ lessonId: "l1", completed: true }]);
  assert.equal(map.get("l1"), true);
  assert.equal(map.get("l2"), true);
});

test("concluir a aula 2 sem concluir a 1 não adianta nada (progresso isolado não pula a fila)", () => {
  const lessons = [
    { id: "l1", status: "published" as const },
    { id: "l2", status: "published" as const },
    { id: "l3", status: "published" as const },
  ];
  // l2 marcada como concluída "no banco" sem l1 estar concluída — não deve
  // acontecer via complete_lesson() (a migration bloqueia), mas a função de
  // desbloqueio da UI também não deve deixar isso destravar l3.
  const map = computeLessonUnlockMap(lessons, [{ lessonId: "l2", completed: true }]);
  assert.equal(map.get("l1"), true);
  assert.equal(map.get("l2"), false, "l2 continua bloqueada: l1 não foi concluída");
  assert.equal(map.get("l3"), false, "l3 continua bloqueada: a corrente parou em l1");
});

test('aula "coming_soon" nunca trava a corrente e nunca aparece como bloqueada', () => {
  const lessons = [
    { id: "l1", status: "published" as const },
    { id: "l2", status: "coming_soon" as const },
    { id: "l3", status: "published" as const },
  ];
  // l1 não concluída -> l3 (próxima PUBLICADA) deveria continuar bloqueada;
  // l2 (coming_soon) sempre aparece liberada, independente de l1.
  const map = computeLessonUnlockMap(lessons, []);
  assert.equal(map.get("l1"), true);
  assert.equal(map.get("l2"), true, "coming_soon sempre acessível, nunca bloqueada");
  assert.equal(map.get("l3"), false, "l3 ainda depende de l1, não de l2");
});

test('aula "draft" é ignorada (nem aparece no mapa)', () => {
  const lessons = [
    { id: "l1", status: "published" as const },
    { id: "l2", status: "draft" as const },
    { id: "l3", status: "published" as const },
  ];
  const map = computeLessonUnlockMap(lessons, [{ lessonId: "l1", completed: true }]);
  assert.equal(map.has("l2"), false, "draft não deveria nem entrar no mapa");
  assert.equal(map.get("l3"), true, "l3 libera normalmente, draft no meio não interfere");
});

test("cadeia atravessa fronteira de módulo (regressão do bug original)", () => {
  // Corresponde exatamente ao bug relatado: aula 1 no módulo A, aula 2 no
  // módulo B — desde que a lista já venha ordenada (módulo, depois aula),
  // o bloqueio precisa atravessar a fronteira normalmente.
  const lessons = [
    { id: "modA-l1", status: "published" as const }, // módulo A, aula 1
    { id: "modB-l1", status: "published" as const }, // módulo B, aula 1
  ];
  const semProgresso = computeLessonUnlockMap(lessons, []);
  assert.equal(semProgresso.get("modA-l1"), true);
  assert.equal(
    semProgresso.get("modB-l1"),
    false,
    "aula do módulo B não pode liberar sem a aula do módulo A concluída",
  );

  const comProgresso = computeLessonUnlockMap(lessons, [
    { lessonId: "modA-l1", completed: true },
  ]);
  assert.equal(comProgresso.get("modB-l1"), true, "libera depois que a do módulo A conclui");
});

test("lista vazia não quebra e retorna mapa vazio", () => {
  const map = computeLessonUnlockMap([], []);
  assert.equal(map.size, 0);
});
