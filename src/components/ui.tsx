import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Plus } from "@/components/icons";

/* -------------------------------------------------------------------------- */
/*  Marcadores +                                                              */
/*  Ficam nos quatro cantos de um bloco, meio para dentro e meio para fora.    */
/*  O pai precisa ser `relative`.                                             */
/* -------------------------------------------------------------------------- */

export function PlusCorners({
  tone = "gold",
  className = "",
}: {
  tone?: "gold" | "royal" | "ash";
  className?: string;
}) {
  const color =
    tone === "gold"
      ? "text-gold"
      : tone === "royal"
        ? "text-royal"
        : "text-ash";

  return (
    <span aria-hidden="true" className={`pointer-events-none ${color} ${className}`}>
      <Plus className="absolute -left-[7px] -top-[7px] h-3.5 w-3.5" />
      <Plus className="absolute -right-[7px] -top-[7px] h-3.5 w-3.5" />
      <Plus className="absolute -bottom-[7px] -left-[7px] h-3.5 w-3.5" />
      <Plus className="absolute -bottom-[7px] -right-[7px] h-3.5 w-3.5" />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Etiqueta de seção — "01/  SERVIÇOS"                                       */
/* -------------------------------------------------------------------------- */

/**
 * A cor sai inteiramente do `tone` — nada de sobrescrever por className, que
 * dependeria da ordem de emissão do CSS e não da ordem do atributo class.
 */
export function SectionEyebrow({
  index,
  label,
  tone = "void",
  as: Tag = "p",
  className = "",
}: {
  index?: string;
  label: string;
  /** Fundo em que a etiqueta está pousada. */
  tone?: "void" | "deep" | "light";
  /** "h2" quando a etiqueta é o único título da seção (caso dos Números). */
  as?: "p" | "h2";
  className?: string;
}) {
  const text =
    tone === "light"
      ? "text-ink-soft"
      : tone === "deep"
        ? "text-white/70"
        : "text-ash";
  const accent = tone === "light" ? "text-royal" : "text-gold";

  return (
    <Tag className={`label-eyebrow flex items-center gap-3 ${text} ${className}`}>
      {index ? (
        <span className={accent} aria-hidden="true">
          {index}
        </span>
      ) : null}
      <span>{label}</span>
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/*  Botões (sempre <Link>, o site não tem ação de formulário fora da news)     */
/* -------------------------------------------------------------------------- */

const buttonBase =
  "group inline-flex items-center justify-center gap-3 rounded-[2px] px-7 py-4 " +
  "font-sans text-[0.6875rem] md:text-xs font-medium uppercase tracking-[0.16em] " +
  "transition-colors duration-300";

export function ButtonPrimary({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`${buttonBase} bg-gold text-void hover:bg-gold-hi ${className}`}
    >
      {children}
      <ArrowRightNudge />
    </Link>
  );
}

export function ButtonGhost({
  href,
  children,
  tone = "dark",
  className = "",
}: {
  href: string;
  children: ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  // Bordas em 40%/50%: são o único indicador visual de que isto é um botão
  // (não há fundo), então precisam dos 3:1 de contraste não-textual.
  const skin =
    tone === "light"
      ? "border border-ink/50 text-ink hover:border-royal hover:text-royal"
      : "border border-white/40 text-white hover:border-gold hover:text-gold";

  return (
    <Link href={href} className={`${buttonBase} ${skin} ${className}`}>
      {children}
      <ArrowRightNudge />
    </Link>
  );
}

/** Setinha que anda 4px no hover do botão que a contém. */
function ArrowRightNudge() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4 transition-transform duration-300 ease-out-expo group-hover:translate-x-1"
    >
      <path d="M4 12h16" />
      <path d="M14 6l6 6-6 6" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Link de texto com sublinhado que cresce                                   */
/* -------------------------------------------------------------------------- */

export function TextLink({
  href,
  children,
  external = false,
  externalLinkHint,
  tone = "dark",
  className = "",
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  /** Texto para leitor de tela quando `external`. Obrigatório nesse caso. */
  externalLinkHint?: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  const skin =
    tone === "light"
      ? "text-ink hover:text-royal"
      : "text-white hover:text-gold";

  const content = (
    <>
      <span className="link-underline">{children}</span>
      {external ? (
        <>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          <span className="sr-only"> {externalLinkHint}</span>
        </>
      ) : null}
    </>
  );

  // min-h-11 dá os 44px de área de toque; o sublinhado fica no <span> interno
  // para continuar colado no texto em vez de descer até o fim da caixa.
  const classes =
    `group inline-flex min-h-11 items-center gap-2 font-sans text-[0.6875rem] md:text-xs ` +
    `font-medium uppercase tracking-[0.16em] transition-colors duration-300 ${skin} ${className}`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Divisória                                                                 */
/* -------------------------------------------------------------------------- */

export function Rule({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <hr
      className={`border-0 border-t ${tone === "light" ? "border-line-light" : "border-line"}`}
    />
  );
}
