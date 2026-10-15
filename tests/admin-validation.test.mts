import assert from "node:assert/strict";
import test from "node:test";
import {
  createCourseSchema,
  createLessonSchema,
  moveSchema,
  setLessonVideoSchema,
  updateLessonSchema,
} from "../src/lib/validation/admin.ts";
import { signupSchema } from "../src/lib/validation/signup.ts";

/**
 * A validação do servidor é o que decide. Estes testes cobrem as regras que,
 * se afrouxarem, produzem dados ruins que só aparecem para o ALUNO:
 * um slug que vira URL ilegível, uma duração absurda, um status inventado.
 */

/* ------------------------------- slug do curso ---------------------------- */

test("o identificador do curso aceita só o que cabe numa URL ditável", () => {
  const validos = ["seu-livro", "curso2", "a-b-c", "escrita-criativa-2026"];
  for (const slug of validos) {
    assert.equal(
      createCourseSchema.safeParse({ slug, titlePt: "T", titleEn: "T" }).success,
      true,
      slug,
    );
  }
});

test("o identificador recusa acento, espaço, maiúscula e hífen solto", () => {
  const invalidos = [
    "Seu-Livro", // maiúscula
    "seu livro", // espaço
    "seu_livro", // underline
    "português", // acento
    "-comeca-com-hifen",
    "termina-com-hifen-",
    "dois--hifens",
    "ab", // curto demais
    "",
  ];
  for (const slug of invalidos) {
    assert.equal(
      createCourseSchema.safeParse({ slug, titlePt: "T", titleEn: "T" }).success,
      false,
      slug,
    );
  }
});

test("curso exige título nos dois idiomas", () => {
  assert.equal(
    createCourseSchema.safeParse({ slug: "ok-slug", titlePt: "", titleEn: "T" }).success,
    false,
  );
  assert.equal(
    createCourseSchema.safeParse({ slug: "ok-slug", titlePt: "T", titleEn: "  " }).success,
    false,
  );
});

/* --------------------------------- aula ----------------------------------- */

const aulaBase = {
  lessonId: "11111111-1111-4111-8111-111111111111",
  titlePt: "Aula",
  titleEn: "Lesson",
  descriptionPt: "",
  descriptionEn: "",
  status: "draft" as const,
};

test("duração vazia vira null — 'sem duração' é diferente de zero", () => {
  const r = updateLessonSchema.safeParse({ ...aulaBase, durationMinutes: "" });
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.durationMinutes, null);
});

test("duração numérica é aceita e chega como número", () => {
  const r = updateLessonSchema.safeParse({ ...aulaBase, durationMinutes: "12" });
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.durationMinutes, 12);
});

test("duração absurda é recusada", () => {
  for (const valor of ["-5", "601", "abc"]) {
    assert.equal(
      updateLessonSchema.safeParse({ ...aulaBase, durationMinutes: valor }).success,
      false,
      valor,
    );
  }
});

test("o status da aula só aceita os três valores do banco", () => {
  for (const status of ["draft", "coming_soon", "published"]) {
    assert.equal(
      updateLessonSchema.safeParse({ ...aulaBase, status, durationMinutes: "" }).success,
      true,
      status,
    );
  }
  // "publicada", "ativo", "PUBLISHED" — qualquer um destes viraria uma linha
  // que a interface não sabe renderizar e que o CHECK do banco recusaria.
  for (const status of ["publicada", "ativo", "PUBLISHED", ""]) {
    assert.equal(
      updateLessonSchema.safeParse({ ...aulaBase, status, durationMinutes: "" }).success,
      false,
      status,
    );
  }
});

test("criar aula exige módulo em UUID — id vindo do formulário não é confiável", () => {
  assert.equal(
    createLessonSchema.safeParse({ moduleId: "abc", titlePt: "A", titleEn: "A" }).success,
    false,
  );
  assert.equal(
    createLessonSchema.safeParse({
      moduleId: "11111111-1111-4111-8111-111111111111",
      titlePt: "A",
      titleEn: "A",
    }).success,
    true,
  );
});

/* -------------------------------- ordenação -------------------------------- */

test("mover aceita só 'up' e 'down'", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(moveSchema.safeParse({ id, direction: "up" }).success, true);
  assert.equal(moveSchema.safeParse({ id, direction: "down" }).success, true);
  assert.equal(moveSchema.safeParse({ id, direction: "top" }).success, false);
  assert.equal(moveSchema.safeParse({ id, direction: "" }).success, false);
});

/* ---------------------------------- vídeo ---------------------------------- */

test("cadastrar vídeo exige um link — vazio não passa da validação", () => {
  const lessonId = "11111111-1111-4111-8111-111111111111";
  assert.equal(setLessonVideoSchema.safeParse({ lessonId, videoUrl: "" }).success, false);
  assert.equal(setLessonVideoSchema.safeParse({ lessonId, videoUrl: "  " }).success, false);
  assert.equal(
    setLessonVideoSchema.safeParse({
      lessonId,
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    }).success,
    true,
  );
});

/* ------------------------------ cadastro público --------------------------- */

const cadastroBase = {
  fullName: "Maria Silva",
  email: "maria@exemplo.com",
  password: "senha-forte-1",
  confirmPassword: "senha-forte-1",
  acceptTerms: true,
};

test("cadastro público exige nome, e-mail, senha de 8+, confirmação e termos", () => {
  assert.equal(signupSchema.safeParse(cadastroBase).success, true);

  const casos: [string, Record<string, unknown>][] = [
    ["nome curto", { fullName: "Ma" }],
    ["e-mail inválido", { email: "maria" }],
    ["senha curta", { password: "1234567", confirmPassword: "1234567" }],
    ["confirmação diferente", { confirmPassword: "outra-coisa" }],
    ["termos recusados", { acceptTerms: false }],
  ];

  for (const [nome, alteracao] of casos) {
    assert.equal(
      signupSchema.safeParse({ ...cadastroBase, ...alteracao }).success,
      false,
      nome,
    );
  }
});

test("o erro de confirmação aponta para o campo de confirmação, não para a senha", () => {
  // Se o erro caísse em `password`, a mensagem apareceria embaixo do campo
  // errado e a pessoa mexeria na senha certa.
  const r = signupSchema.safeParse({ ...cadastroBase, confirmPassword: "diferente" });
  assert.equal(r.success, false);
  assert.equal(r.success === false && r.error.issues[0]?.path[0], "confirmPassword");
});
