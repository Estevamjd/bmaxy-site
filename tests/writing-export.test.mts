import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  canStubModules,
  createFakeClient,
  resetHarness,
  skipWithoutStubs,
  stubSupabase,
} from "./action-harness.mts";

const route = canStubModules
  ? await import("../src/app/(app)/aluno/meu-livro/exportar/route.ts")
  : null;

beforeEach(() => resetHarness());

function requestFor(projectId: string) {
  return {
    nextUrl: new URL(`http://localhost:3000/aluno/meu-livro/exportar?projeto=${projectId}`),
  } as never;
}

test("exporta somente projeto e capítulos filtrados pelo dono", { skip: skipWithoutStubs }, async () => {
  const projectId = "55555555-5555-4555-8555-555555555555";
  const client = createFakeClient((_op, index) =>
    index === 0
      ? { data: { id: projectId, title: "Memórias & caminhos" } }
      : {
          data: [
            { title: "Primeiro", content: "Texto um", order_index: 0 },
            { title: "Segundo", content: "Texto dois", order_index: 1 },
          ],
        },
  );
  stubSupabase(client);

  const response = await route!.GET(requestFor(projectId));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain; charset=utf-8$/);
  assert.match(response.headers.get("content-disposition") ?? "", /^attachment;/);
  assert.match(body, /Memórias & caminhos/);
  assert.match(body, /Primeiro\n\nTexto um/);
  assert.match(body, /Segundo\n\nTexto dois/);
  assert.deepEqual(client.calls[0]?.filters, {
    id: projectId,
    user_id: "student-de-teste",
  });
  assert.deepEqual(client.calls[1]?.filters, {
    project_id: projectId,
    user_id: "student-de-teste",
  });
});

test("ID alheio ou inexistente resulta em 404 sem consultar capítulos", { skip: skipWithoutStubs }, async () => {
  const projectId = "66666666-6666-4666-8666-666666666666";
  const client = createFakeClient(() => ({ data: null }));
  stubSupabase(client);

  const response = await route!.GET(requestFor(projectId));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(client.calls.length, 1);
});
