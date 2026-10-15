import assert from "node:assert/strict";
import test from "node:test";
import { createAdminValidation } from "../src/lib/validation/admin.ts";
import {
  createFakeClient,
  formDataOf,
  resetHarness,
  skipWithoutStubs,
  stubSupabase,
} from "./action-harness.mts";

test("admin validation returns English feedback for an English profile", () => {
  const result = createAdminValidation("en").createStudentSchema.safeParse({
    fullName: "",
    email: "invalid",
    temporaryPassword: "short",
  });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.issues[0]?.message, "Enter the student's name.");
});

test("admin Server Action uses the authenticated profile locale", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  Object.assign(globalThis, { __bmaxyAdminLocale: "en" });
  const client = createFakeClient(() => ({ error: { code: "XX000" } }));
  stubSupabase(client);

  const { createModuleAction } = await import("@/lib/actions/admin");
  const state = await createModuleAction(
    undefined,
    formDataOf({
      courseId: "11111111-1111-4111-8111-111111111111",
      titlePt: "Módulo",
      titleEn: "Module",
    }),
  );

  assert.equal(state?.error, "We couldn't create the module.");
});
