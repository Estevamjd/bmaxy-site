"use client";

import { ActionForm, Field, SubmitButton } from "@/components/platform/AdminForms";
import { createStudentAction } from "@/lib/actions/admin";
import type { AdminContent } from "@/content/admin";

export function CreateStudentForm({ content }: { content: AdminContent }) {
  const copy = content.students.new;
  return (
    <ActionForm action={createStudentAction} className="max-w-md space-y-5">
      <Field label={copy.fullName} name="fullName" type="text" required />
      <Field
        label={copy.email}
        name="email"
        type="email"
        autoComplete="off"
        required
        hint={copy.emailHint}
      />
      <Field
        label={copy.temporaryPassword}
        name="temporaryPassword"
        type="text"
        autoComplete="off"
        required
        minLength={8}
        hint={copy.passwordHint}
      />
      <SubmitButton pendingLabel={copy.pending}>{copy.submit}</SubmitButton>
    </ActionForm>
  );
}
