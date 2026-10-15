"use client";

import { useFormStatus } from "react-dom";
import { useId, useState, type InputHTMLAttributes } from "react";

/**
 * Primitivos de formulário da plataforma (login, recuperação de senha,
 * cadastro de aluno). Visualmente simples de propósito — cartão escuro,
 * acento dourado — só o essencial pra não brigar com a identidade da
 * landing sem duplicar os componentes dela (que são bilíngues e pensados
 * pra marketing, não pra formulário autenticado).
 */

export function AuthCard({
  title,
  subtitle,
  width = "narrow",
  children,
}: {
  title: string;
  subtitle?: string;
  /** "wide" para formulários com mais de três campos (cadastro). */
  width?: "narrow" | "wide";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`w-full rounded-[2px] border border-line bg-deep-surface p-8 ${
        width === "wide" ? "max-w-md" : "max-w-sm"
      }`}
    >
      <h1 className="display text-2xl text-white">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-ash">{subtitle}</p> : null}
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function TextField({
  label,
  name,
  error,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="label-eyebrow block text-ash">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="mt-2 w-full rounded-[2px] border border-line bg-void px-4 py-3 text-white placeholder:text-ash/60 focus:border-gold focus:outline-none"
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Checkbox com rótulo clicável (o <label> envolve o input) e mensagem de erro
 * ligada por aria-describedby, igual aos campos de texto. O alvo tem 44px de
 * altura mínima — um quadradinho de 16px sozinho é pequeno demais no celular.
 */
export function CheckboxField({
  name,
  error,
  defaultChecked,
  children,
}: {
  name: string;
  error?: string;
  defaultChecked?: boolean;
  /** Rótulo — aceita nós para caber link de termos dentro. */
  children: React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-gold"
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-ash">
          {children}
        </label>
      </div>
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField({
  label,
  name,
  error,
  autoComplete,
  showLabel = "Mostrar",
  hideLabel = "Ocultar",
}: {
  label: string;
  name: string;
  error?: string;
  autoComplete?: string;
  showLabel?: string;
  hideLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="label-eyebrow block text-ash">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded-[2px] border border-line bg-void px-4 py-3 pr-20 text-white focus:border-gold focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-ash hover:text-gold"
        >
          {visible ? hideLabel : showLabel}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Aguarde…",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex min-h-11 w-full items-center justify-center rounded-[2px] bg-gold px-6 py-3 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-void transition-colors duration-300 hover:bg-gold-hi disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="mb-4 border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
      {message}
    </p>
  );
}

/**
 * Aviso neutro — nem erro, nem sucesso. Existe para o estado em que o
 * formulário está correto mas o sistema ainda não faz o que promete (hoje:
 * cadastro sem provedor ligado). Pintar isso de vermelho culparia quem
 * preencheu; pintar de dourado pareceria que deu certo.
 */
export function FormNotice({
  message,
  children,
}: {
  message?: string;
  children?: React.ReactNode;
}) {
  if (!message && !children) return null;
  return (
    <div
      role="status"
      className="mb-4 border border-white/25 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/85"
    >
      {message}
      {children}
    </div>
  );
}
