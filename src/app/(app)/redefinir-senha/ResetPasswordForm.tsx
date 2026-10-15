"use client";

import { useActionState } from "react";
import { resetPasswordAction, type AuthActionState } from "@/lib/actions/auth";
import { FormError, PasswordField, SubmitButton } from "@/components/platform/form";
import type { PlatformContent } from "@/content/platform";

export function ResetPasswordForm({ next, content }: { next: string; content: PlatformContent }) {
  const copy = content.auth.reset;
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    resetPasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.error} />
      <PasswordField
        label={copy.newPassword}
        name="password"
        autoComplete="new-password"
        showLabel={content.common.showPassword}
        hideLabel={content.common.hidePassword}
      />
      <PasswordField
        label={copy.confirmPassword}
        name="confirmPassword"
        autoComplete="new-password"
        showLabel={content.common.showPassword}
        hideLabel={content.common.hidePassword}
      />
      <SubmitButton pendingLabel={content.common.wait}>{copy.submit}</SubmitButton>
    </form>
  );
}
