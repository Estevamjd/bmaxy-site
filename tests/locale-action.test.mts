import assert from "node:assert/strict";
import test from "node:test";
import {
  createFakeClient,
  formDataOf,
  resetHarness,
  skipWithoutStubs,
  stubSupabase,
} from "./action-harness.mts";

async function localeAction() {
  return import("@/lib/actions/locale");
}

test("visitante persiste o locale sem acessar profiles", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const client = createFakeClient(() => ({ data: null }));
  stubSupabase(client);

  const { updateLocaleAction } = await localeAction();
  const result = await updateLocaleAction(undefined, formDataOf({ locale: "en" }));

  assert.deepEqual(result, { status: "success" });
  assert.equal(client.calls.length, 0);
  assert.equal((globalThis as { __bmaxyLocale?: string }).__bmaxyLocale, "en");
});

test("usuário atualiza somente o próprio profile antes do cookie", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  Object.assign(globalThis, {
    __bmaxyAuthContext: {
      userId: "11111111-1111-4111-8111-111111111111",
      locale: "pt",
      role: "student",
    },
  });
  const client = createFakeClient(() => ({ data: { id: "11111111-1111-4111-8111-111111111111" } }));
  stubSupabase(client);

  const { updateLocaleAction } = await localeAction();
  const result = await updateLocaleAction(undefined, formDataOf({ locale: "en" }));

  assert.deepEqual(result, { status: "success" });
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0]?.table, "profiles");
  assert.equal(client.calls[0]?.kind, "update");
  assert.deepEqual(client.calls[0]?.payload, { locale: "en" });
  assert.equal(client.calls[0]?.filters.id, "11111111-1111-4111-8111-111111111111");
  assert.equal((globalThis as { __bmaxyLocale?: string }).__bmaxyLocale, "en");
});

test("update sem linha não relata sucesso nem altera o cookie", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  Object.assign(globalThis, {
    __bmaxyAuthContext: {
      userId: "11111111-1111-4111-8111-111111111111",
      locale: "pt",
      role: "student",
    },
  });
  const client = createFakeClient(() => ({ data: null, error: null }));
  stubSupabase(client);

  const { updateLocaleAction } = await localeAction();
  const result = await updateLocaleAction(undefined, formDataOf({ locale: "en" }));

  assert.equal(result.status, "error");
  assert.equal((globalThis as { __bmaxyLocale?: string }).__bmaxyLocale, "pt");
});

test("locale fora da allowlist é rejeitado sem escrita", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const client = createFakeClient(() => ({ data: null }));
  stubSupabase(client);

  const { updateLocaleAction } = await localeAction();
  const result = await updateLocaleAction(undefined, formDataOf({ locale: "es" }));

  assert.equal(result.status, "error");
  assert.equal(client.calls.length, 0);
  assert.equal((globalThis as { __bmaxyLocale?: string }).__bmaxyLocale, "pt");
});
