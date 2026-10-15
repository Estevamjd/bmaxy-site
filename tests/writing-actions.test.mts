import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  canStubModules,
  createFakeClient,
  formDataOf,
  resetHarness,
  skipWithoutStubs,
  stubSupabase,
} from "./action-harness.mts";

const actions = canStubModules ? await import("../src/lib/actions/writing.ts") : null;

beforeEach(() => resetHarness());

test("cria projeto e primeiro capítulo em uma única RPC", { skip: skipWithoutStubs }, async () => {
  const client = createFakeClient(() => ({ data: "project-id" }));
  stubSupabase(client);

  const result = await actions!.criarProjetoAction(
    undefined,
    formDataOf({ title: "Meu livro" }),
  );

  assert.deepEqual(result, { success: "Projeto criado." });
  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0], {
    kind: "rpc",
    fn: "create_writing_project",
    args: {
      p_project_title: "Meu livro",
      p_initial_chapter_title: "Capítulo 1",
    },
    filters: {},
    single: false,
    seq: 2,
  });
});

test("cria capítulo pela RPC serializada", { skip: skipWithoutStubs }, async () => {
  const client = createFakeClient(() => ({ data: "chapter-id" }));
  stubSupabase(client);

  const result = await actions!.criarCapituloAction(
    undefined,
    formDataOf({
      projectId: "11111111-1111-4111-8111-111111111111",
      title: "",
    }),
  );

  assert.deepEqual(result, { success: "Capítulo criado." });
  assert.equal(client.calls[0]?.fn, "create_writing_chapter");
  assert.deepEqual(client.calls[0]?.args, {
    p_project_id: "11111111-1111-4111-8111-111111111111",
    p_title: "",
  });
});

test("move capítulo com uma única chamada transacional", { skip: skipWithoutStubs }, async () => {
  const client = createFakeClient(() => ({ data: true }));
  stubSupabase(client);

  const result = await actions!.moverCapituloAction(
    undefined,
    formDataOf({
      chapterId: "22222222-2222-4222-8222-222222222222",
      direction: "down",
    }),
  );

  assert.equal(result, undefined);
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0]?.fn, "move_writing_chapter");
});

test("não relata exclusão de projeto sem linha afetada como sucesso", { skip: skipWithoutStubs }, async () => {
  const client = createFakeClient(() => ({ data: null }));
  stubSupabase(client);

  const result = await actions!.excluirProjetoAction(
    undefined,
    formDataOf({ projectId: "33333333-3333-4333-8333-333333333333" }),
  );

  assert.ok(result?.error);
  assert.equal(client.calls[0]?.kind, "delete");
  assert.equal(client.calls[0]?.columns, "id");
  assert.equal(client.calls[0]?.single, true);
});

test("não relata exclusão de capítulo sem linha afetada como sucesso", { skip: skipWithoutStubs }, async () => {
  const client = createFakeClient(() => ({ data: null }));
  stubSupabase(client);

  const result = await actions!.excluirCapituloAction(
    undefined,
    formDataOf({ chapterId: "44444444-4444-4444-8444-444444444444" }),
  );

  assert.ok(result?.error);
  assert.equal(client.calls[0]?.kind, "delete");
  assert.equal(client.calls[0]?.columns, "id");
});
