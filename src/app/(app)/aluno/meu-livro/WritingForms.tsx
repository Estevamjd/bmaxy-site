"use client";

import { useActionState } from "react";
import { ConfirmationDialog } from "@/components/platform/ConfirmationDialog";
import { ErrorNotice, SuccessNotice } from "@/components/platform/ui";
import {
  atualizarProjetoAction,
  criarCapituloAction,
  criarProjetoAction,
  excluirCapituloAction,
  excluirProjetoAction,
  moverCapituloAction,
  type WritingActionState,
} from "@/lib/actions/writing";

/**
 * Os formulários do Estúdio. Client Components porque precisam de
 * `useActionState` para mostrar erro e sucesso sem sair da página.
 *
 * O EDITOR não está aqui — ele tem estado próprio e vive em
 * `components/platform/ChapterEditor.tsx`.
 */

type Acao = (
  estado: WritingActionState,
  formData: FormData,
) => Promise<WritingActionState>;

function Botao({
  children,
  tone = "primary",
  pendingLabel,
}: {
  children: React.ReactNode;
  tone?: "primary" | "ghost";
  pendingLabel: string;
}) {
  const estilos =
    tone === "primary"
      ? "bg-gold text-void hover:bg-gold-hi"
      : "border border-panel-line text-white hover:border-gold hover:text-gold";
  return (
    <button
      type="submit"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] px-5 py-2.5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${estilos}`}
      data-pending-label={pendingLabel}
    >
      {children}
    </button>
  );
}

function Formulario({
  action,
  hidden,
  children,
  className = "",
}: {
  action: Acao;
  hidden?: Record<string, string>;
  children: React.ReactNode;
  className?: string;
}) {
  const [estado, formAction] = useActionState<WritingActionState, FormData>(action, undefined);

  return (
    <form action={formAction} className={className} noValidate>
      {hidden
        ? Object.entries(hidden).map(([nome, valor]) => (
            <input key={nome} type="hidden" name={nome} value={valor} />
          ))
        : null}
      <ErrorNotice message={estado?.error} />
      <SuccessNotice message={estado?.success} />
      {children}
    </form>
  );
}

/* ------------------------------- criar ------------------------------------ */

export function CriarProjetoForm({
  labels,
}: {
  labels: { title: string; placeholder: string; submit: string; pending: string };
}) {
  return (
    <Formulario action={criarProjetoAction} className="space-y-4">
      <label className="block">
        <span className="label-eyebrow text-ash">{labels.title}</span>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder={labels.placeholder}
          className="mt-2 w-full rounded-[3px] border border-panel-line bg-panel px-4 py-3 text-white outline-none transition-colors focus:border-gold"
        />
      </label>
      <Botao pendingLabel={labels.pending}>{labels.submit}</Botao>
    </Formulario>
  );
}

/* ---------------------------- dados do projeto ---------------------------- */

export function DadosDoProjetoForm({
  projectId,
  title,
  genre,
  description,
  wordGoal,
  labels,
}: {
  projectId: string;
  title: string;
  genre: string;
  description: string;
  wordGoal: number | null;
  labels: {
    title: string;
    genre: string;
    genreHint: string;
    description: string;
    wordGoal: string;
    wordGoalHint: string;
    submit: string;
    pending: string;
  };
}) {
  return (
    <Formulario action={atualizarProjetoAction} hidden={{ projectId }} className="space-y-5">
      <label className="block">
        <span className="label-eyebrow text-ash">{labels.title}</span>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={title}
          className="mt-2 w-full rounded-[3px] border border-panel-line bg-panel px-4 py-3 text-white outline-none transition-colors focus:border-gold"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="label-eyebrow text-ash">{labels.genre}</span>
          <input
            name="genre"
            type="text"
            maxLength={80}
            defaultValue={genre}
            placeholder={labels.genreHint}
            className="mt-2 w-full rounded-[3px] border border-panel-line bg-panel px-4 py-3 text-white outline-none transition-colors focus:border-gold"
          />
        </label>

        <label className="block">
          <span className="label-eyebrow text-ash">{labels.wordGoal}</span>
          <input
            name="wordGoal"
            type="number"
            min={1}
            defaultValue={wordGoal ?? ""}
            placeholder={labels.wordGoalHint}
            className="mt-2 w-full rounded-[3px] border border-panel-line bg-panel px-4 py-3 text-white outline-none transition-colors focus:border-gold"
          />
        </label>
      </div>

      <label className="block">
        <span className="label-eyebrow text-ash">{labels.description}</span>
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={description}
          className="mt-2 w-full resize-y rounded-[3px] border border-panel-line bg-panel px-4 py-3 leading-relaxed text-white outline-none transition-colors focus:border-gold"
        />
      </label>

      <Botao pendingLabel={labels.pending}>{labels.submit}</Botao>
    </Formulario>
  );
}

/* ------------------------------- capítulos -------------------------------- */

export function CriarCapituloForm({
  projectId,
  label,
  pending,
}: {
  projectId: string;
  label: string;
  pending: string;
}) {
  return (
    <Formulario action={criarCapituloAction} hidden={{ projectId, title: "" }}>
      <Botao tone="ghost" pendingLabel={pending}>
        {label}
      </Botao>
    </Formulario>
  );
}

export function MoverCapituloForm({
  chapterId,
  direction,
  label,
  disabled,
}: {
  chapterId: string;
  direction: "up" | "down";
  label: string;
  disabled: boolean;
}) {
  const [, formAction] = useActionState<WritingActionState, FormData>(
    moverCapituloAction,
    undefined,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="chapterId" value={chapterId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-panel-line text-ash transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

/* ------------------------------- exclusões -------------------------------- */

/**
 * Exclusão sempre atrás de confirmação. Um capítulo apagado por engano é
 * texto que a pessoa escreveu e não volta — não há lixeira.
 */
function ExclusaoConfirmada({
  action,
  hidden,
  labels,
}: {
  action: Acao;
  hidden: Record<string, string>;
  labels: { trigger: string; title: string; description: string; confirm: string; cancel?: string };
}) {
  const [estado, formAction] = useActionState<WritingActionState, FormData>(action, undefined);

  return (
    <div>
      <ConfirmationDialog
        triggerLabel={labels.trigger}
        title={labels.title}
        description={labels.description}
        cancelLabel={labels.cancel}
        triggerTone="danger"
      >
        <form action={formAction}>
          {Object.entries(hidden).map(([nome, valor]) => (
            <input key={nome} type="hidden" name={nome} value={valor} />
          ))}
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[3px] border border-red-400/50 px-5 py-2.5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-red-300 transition-colors duration-300 hover:bg-red-400/10"
          >
            {labels.confirm}
          </button>
        </form>
      </ConfirmationDialog>

      {estado?.error ? (
        <div className="mt-3">
          <ErrorNotice message={estado.error} />
        </div>
      ) : null}
    </div>
  );
}

export function ExcluirCapituloForm({
  chapterId,
  labels,
}: {
  chapterId: string;
  labels: { trigger: string; title: string; description: string; confirm: string; cancel?: string };
}) {
  return (
    <ExclusaoConfirmada
      action={excluirCapituloAction}
      hidden={{ chapterId }}
      labels={labels}
    />
  );
}

export function ExcluirProjetoForm({
  projectId,
  labels,
}: {
  projectId: string;
  labels: { trigger: string; title: string; description: string; confirm: string; cancel?: string };
}) {
  return (
    <ExclusaoConfirmada
      action={excluirProjetoAction}
      hidden={{ projectId }}
      labels={labels}
    />
  );
}
