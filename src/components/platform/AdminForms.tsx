"use client";

import { useActionState, useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmationDialog } from "@/components/platform/ConfirmationDialog";
import { buttonStyles, ErrorNotice, SuccessNotice, type ButtonTone } from "@/components/platform/ui";
import type { AdminActionState } from "@/lib/actions/admin";

/**
 * =============================================================================
 *  FORMULÁRIOS DO PAINEL
 * =============================================================================
 *
 *  Todas as ações administrativas são <form> + Server Action. Nenhum `fetch`
 *  manual, nenhum estado de dados no cliente: quem valida e quem decide é o
 *  servidor, e a checagem de admin acontece lá dentro (`requireAdmin()`), não
 *  aqui. Esconder um botão nunca foi autorização.
 *
 *  O que estes componentes acrescentam é só experiência: estado de envio,
 *  mensagem de erro/sucesso no lugar certo e confirmação antes do que não se
 *  desfaz.
 * =========================================================================== */

/* -------------------------------------------------------------------------- */
/*  Campos                                                                    */
/* -------------------------------------------------------------------------- */

const fieldClasses =
  "mt-1.5 w-full rounded-[3px] border border-panel-line bg-void px-3.5 py-2.5 font-sans text-sm " +
  "text-warm-white placeholder:text-ash/60 transition-colors duration-200 " +
  "focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label,
  name,
  hint,
  ...props
}: {
  label: string;
  name: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="label-eyebrow block text-ash">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-describedby={hint ? hintId : undefined}
        className={fieldClasses}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-ash">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  hint,
  ...props
}: {
  label: string;
  name: string;
  hint?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="label-eyebrow block text-ash">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        aria-describedby={hint ? hintId : undefined}
        className={`${fieldClasses} resize-y`}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-ash">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label-eyebrow block text-ash">
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={fieldClasses}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-void">
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-ash">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Botão de envio                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `useFormStatus` só enxerga o <form> ANCESTRAL — por isso é um componente
 * separado, e não um `pending` lido no mesmo nível do `useActionState`.
 *
 * O rótulo muda para "Salvando…" e o botão desabilita: sem isso, um clique
 * duplo em "Liberar curso" dispara a ação duas vezes.
 */
export function SubmitButton({
  children,
  tone = "primary",
  pendingLabel = "Salvando…",
  className = "",
}: {
  children: ReactNode;
  tone?: ButtonTone;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonStyles[tone]} ${className}`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Botão de ação curta (mover, remover) — quadrado, só ícone. */
export function IconSubmitButton({
  label,
  children,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-panel-line text-ash transition-colors duration-200 hover:border-ash hover:text-warm-white disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Formulário de ação                                                        */
/* -------------------------------------------------------------------------- */

export type AdminAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

/**
 * Envolve uma Server Action com estado de erro/sucesso. `children` recebe os
 * campos; os ocultos vêm por `hidden`.
 *
 * `noValidate` é proposital: com a validação nativa ligada, o navegador
 * bloqueia o envio com um balão próprio e a nossa mensagem — que é a que fica
 * associada ao campo — nunca chega a aparecer.
 */
export function ActionForm({
  action,
  hidden,
  children,
  className = "",
  noticePosition = "top",
}: {
  action: AdminAction;
  hidden?: Record<string, string>;
  children: ReactNode;
  className?: string;
  noticePosition?: "top" | "bottom";
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(action, undefined);

  const notices = (
    <>
      <ErrorNotice message={state?.error} />
      <SuccessNotice message={state?.success} />
    </>
  );

  return (
    <form action={formAction} noValidate className={className}>
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {noticePosition === "top" && (state?.error || state?.success) ? (
        <div className="mb-4">{notices}</div>
      ) : null}
      {children}
      {noticePosition === "bottom" && (state?.error || state?.success) ? (
        <div className="mt-4">{notices}</div>
      ) : null}
    </form>
  );
}

/**
 * Ação destrutiva com confirmação. O <form> vive DENTRO do diálogo, então a
 * ação continua sendo um envio de formulário de verdade — o diálogo só decide
 * quando ele aparece.
 */
export function DangerActionForm({
  action,
  hidden,
  triggerLabel,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  pendingLabel = "Aguarde…",
}: {
  action: AdminAction;
  hidden: Record<string, string>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(action, undefined);

  return (
    <div>
      <ConfirmationDialog
        triggerLabel={triggerLabel}
        title={title}
        description={description}
        cancelLabel={cancelLabel}
        triggerTone="danger"
      >
        <form action={formAction}>
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <SubmitButton tone="danger" pendingLabel={pendingLabel}>
            {confirmLabel}
          </SubmitButton>
        </form>
      </ConfirmationDialog>

      {state?.error || state?.success ? (
        <div className="mt-3">
          <ErrorNotice message={state?.error} />
          <SuccessNotice message={state?.success} />
        </div>
      ) : null}
    </div>
  );
}
