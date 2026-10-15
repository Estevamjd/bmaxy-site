"use client";

import {
  ActionForm,
  DangerActionForm,
  Field,
  SelectField,
  SubmitButton,
} from "@/components/platform/AdminForms";
import {
  enrollStudentAction,
  resendPasswordResetAction,
  revokeEnrollmentAction,
  updateStudentNameAction,
} from "@/lib/actions/admin";
import { formatAdminMessage, type AdminContent } from "@/content/admin";

export function EditNameForm({
  userId,
  fullName,
  content,
}: {
  userId: string;
  fullName: string;
  content: AdminContent;
}) {
  const copy = content.students.forms;
  return (
    <ActionForm
      action={updateStudentNameAction}
      hidden={{ userId }}
      className="max-w-sm space-y-4"
      noticePosition="bottom"
    >
      <Field
        label={copy.fullName}
        name="fullName"
        type="text"
        defaultValue={fullName}
        required
        hint={copy.fullNameHint}
      />
      <SubmitButton tone="secondary" pendingLabel={content.common.saving}>{copy.saveName}</SubmitButton>
    </ActionForm>
  );
}

export function EnrollForm({
  userId,
  availableCourses,
  content,
}: {
  userId: string;
  availableCourses: { id: string; title: string }[];
  content: AdminContent;
}) {
  const copy = content.students.forms;
  if (availableCourses.length === 0) {
    return (
      <p className="text-sm text-ash">
        {copy.allCoursesGranted}
      </p>
    );
  }

  return (
    <ActionForm
      action={enrollStudentAction}
      hidden={{ userId }}
      className="space-y-4"
      noticePosition="bottom"
    >
      <div className="max-w-sm">
        <SelectField
          label={copy.course}
          name="courseId"
          options={availableCourses.map((course) => ({ value: course.id, label: course.title }))}
        />
      </div>
      <SubmitButton pendingLabel={content.common.granting}>{copy.grantCourse}</SubmitButton>
    </ActionForm>
  );
}

/**
 * Revogar tira o acesso de alguém que está estudando — e o progresso continua
 * gravado, mas invisível para a pessoa. Não é uma ação para um clique
 * distraído, então passa por confirmação.
 */
export function RevokeForm({
  enrollmentId,
  userId,
  courseTitle,
  content,
}: {
  enrollmentId: string;
  userId: string;
  courseTitle: string;
  content: AdminContent;
}) {
  const copy = content.students.forms;
  return (
    <DangerActionForm
      action={revokeEnrollmentAction}
      hidden={{ enrollmentId, userId }}
      triggerLabel={copy.revoke}
      title={copy.revokeTitle}
      description={formatAdminMessage(copy.revokeDescription, { title: courseTitle })}
      confirmLabel={copy.revokeConfirm}
      cancelLabel={content.common.cancel}
      pendingLabel={content.common.wait}
    />
  );
}

export function ResendResetButton({ email, content }: { email: string; content: AdminContent }) {
  return (
    <ActionForm action={resendPasswordResetAction} hidden={{ email }} noticePosition="bottom">
      <SubmitButton tone="secondary" pendingLabel={content.common.sending}>
        {content.students.forms.sendReset}
      </SubmitButton>
    </ActionForm>
  );
}
