import Link from "next/link";
import type { ReactNode } from "react";

/**
 * =============================================================================
 *  DESIGN SYSTEM DA PLATAFORMA — primitivos sem JavaScript no cliente
 * =============================================================================
 *
 *  Tudo aqui é Server Component. Só vira Client Component o que precisa de
 *  estado (ActionMenu, ConfirmationDialog, PlatformSidebar) — e esses moram em
 *  arquivos próprios. Isso mantém o JS da plataforma perto de zero.
 *
 *  A linguagem visual sai da identidade da landing, adaptada para trabalho:
 *  fundo --void, superfícies em --panel, filete --panel-line, títulos em
 *  --warm-white (branco puro sobre índigo fica azulado), dourado SÓ onde
 *  significa alguma coisa (ação principal, item ativo, destaque de progresso).
 *  Se o dourado aparecer em três lugares na mesma tela, um deles está errado.
 *
 *  Espaçamento e tipografia seguem a landing: `display` nos títulos,
 *  `label-eyebrow` nas etiquetas, Inter no resto.
 * =========================================================================== */

/* -------------------------------------------------------------------------- */
/*  Superfície                                                                */
/* -------------------------------------------------------------------------- */

export function Panel({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={`rounded-[3px] border border-panel-line bg-panel shadow-[0_1px_2px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cabeçalho de página                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Toda página da plataforma abre igual: etiqueta, título, uma linha de
 * contexto e (opcionalmente) as ações à direita. É o que faz `/admin/alunos` e
 * `/aluno/curso/x` parecerem o mesmo produto.
 *
 * `backHref` só aparece em páginas de detalhe — o caminho de volta precisa
 * existir antes do conteúdo, não depois.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-panel-line pb-6 md:pb-8">
      {backHref ? (
        <Link
          href={backHref}
          className="group -ml-1 mb-4 inline-flex min-h-9 items-center gap-2 px-1 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ash transition-colors duration-200 hover:text-warm-white"
        >
          <span aria-hidden="true">←</span>
          <span className="link-underline">{backLabel ?? "Voltar"}</span>
        </Link>
      ) : null}

      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0">
          {eyebrow ? <p className="label-eyebrow text-gold">{eyebrow}</p> : null}
          <h1 className="display mt-3 text-[1.75rem] leading-[1.05] text-warm-white md:text-[2.25rem]">
            {title}
          </h1>
          {description ? (
            <p className="measure mt-3 text-[0.9375rem] leading-relaxed text-ash">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

/** Título de bloco dentro de uma página. Um nível abaixo do PageHeader. */
export function SectionHeading({
  title,
  description,
  actions,
  as: Tag = "h2",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Tag className="display text-[1.125rem] text-warm-white md:text-[1.25rem]">{title}</Tag>
        {description ? <p className="mt-1.5 text-sm text-ash">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Botões                                                                    */
/* -------------------------------------------------------------------------- */

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] px-5 font-sans " +
  "text-[0.6875rem] font-medium uppercase tracking-[0.14em] transition-colors duration-200 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const buttonStyles = {
  /** Ação principal da tela. NO MÁXIMO uma por tela. */
  primary: `${buttonBase} bg-gold text-void hover:bg-gold-hi`,
  /** Ação secundária, comum. */
  secondary: `${buttonBase} border border-panel-line bg-panel text-warm-white hover:border-ash hover:bg-panel-hi`,
  /** Ação terciária, sem caixa. */
  ghost: `${buttonBase} text-ash hover:text-warm-white`,
  /** Destrutiva. Vermelho só aqui. */
  danger: `${buttonBase} border border-red-400/40 text-red-300 hover:border-red-400 hover:bg-red-400/10`,
} as const;

export type ButtonTone = keyof typeof buttonStyles;

export function ButtonLink({
  href,
  tone = "secondary",
  children,
  className = "",
}: {
  href: string;
  tone?: ButtonTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonStyles[tone]} ${className}`}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Métrica                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Número real, rótulo, e — quando ajuda — uma linha de contexto.
 *
 * NÃO tem variação percentual, seta de tendência nem gráfico: não existe
 * histórico no banco para comparar contra, e inventar tendência é pior do que
 * não mostrar nenhuma. Quando houver histórico de verdade, é aqui que ele
 * entra.
 */
export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** "attention" quando o número pede uma ação (ex.: aulas sem vídeo). */
  tone?: "neutral" | "attention";
  href?: string;
}) {
  const body = (
    <>
      <dt className="label-eyebrow text-ash">{label}</dt>
      <dd
        className={`display mt-3 text-[2rem] leading-none md:text-[2.5rem] ${
          tone === "attention" && Number(value) > 0 ? "text-gold" : "text-warm-white"
        }`}
      >
        {value}
      </dd>
      {hint ? <p className="mt-3 text-xs leading-relaxed text-ash">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-[3px] border border-panel-line bg-panel p-5 transition-colors duration-200 hover:border-ash hover:bg-panel-hi md:p-6"
      >
        <div className="flex h-full flex-col">{body}</div>
      </Link>
    );
  }

  return (
    <div className="flex flex-col rounded-[3px] border border-panel-line bg-panel p-5 md:p-6">
      {body}
    </div>
  );
}

/** Grade de métricas: 2 colunas no celular, 3 ou 4 no desktop. */
export function MetricGrid({
  children,
  columns = 4,
}: {
  children: ReactNode;
  columns?: 3 | 4;
}) {
  return (
    <dl
      className={`grid grid-cols-2 gap-3 md:gap-4 ${
        columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
      }`}
    >
      {children}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */
/*  Selo de estado                                                            */
/* -------------------------------------------------------------------------- */

const badgeTones = {
  /** Concluído, ativo, publicado. */
  success: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  /** Disponível agora, próxima ação. */
  active: "border-gold/40 bg-gold/10 text-gold",
  /** Rascunho, revogado, bloqueado — sem alarme, só apagado. */
  muted: "border-panel-line bg-panel-hi text-ash",
  /** Em breve, aguardando algo. */
  pending: "border-violet-hi/35 bg-violet-hi/10 text-violet-hi",
  /** Falta alguma coisa para funcionar (aula publicada sem vídeo). */
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-300",
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function StatusBadge({
  tone = "muted",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[0.6875rem] font-medium leading-none ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Barra de progresso                                                        */
/* -------------------------------------------------------------------------- */

/**
 * `role="progressbar"` com os valores reais — um leitor de tela anuncia
 * "60 por cento" em vez de descrever uma caixa colorida. O texto ao lado não é
 * decoração: quem não enxerga a barra continua sabendo o número.
 */
export function ProgressBar({
  value,
  max,
  label,
  ofLabel = "de",
  showText = true,
  size = "md",
}: {
  value: number;
  max: number;
  label: string;
  ofLabel?: string;
  showText?: boolean;
  size?: "sm" | "md";
}) {
  const safeMax = Math.max(max, 0);
  const safeValue = Math.min(Math.max(value, 0), safeMax);
  const percent = safeMax === 0 ? 0 : Math.round((safeValue / safeMax) * 100);

  return (
    <div>
      {showText ? (
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <span className="label-eyebrow text-ash">{label}</span>
          <span className="font-sans text-sm text-warm-white">
            {safeValue} {ofLabel} {safeMax}
          </span>
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label}
        className={`w-full overflow-hidden rounded-full bg-panel-hi ${
          size === "sm" ? "h-1" : "h-1.5"
        }`}
      >
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out-expo"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Estado vazio                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Um vazio bem feito explica POR QUE está vazio e o que fazer a seguir. Um
 * vazio mal feito diz "nenhum resultado" e deixa a pessoa parada.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-[3px] border border-dashed border-panel-line bg-panel/50 text-center ${
        compact ? "px-6 py-10" : "px-6 py-16"
      }`}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-panel-line bg-panel text-ash"
        >
          {icon}
        </span>
      ) : null}
      <p className="display text-[1.125rem] text-warm-white md:text-[1.25rem]">{title}</p>
      <p className="measure mt-3 text-sm leading-relaxed text-ash">{description}</p>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Seção de formulário                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Agrupa campos com título e explicação à esquerda, campos à direita (no
 * desktop). É o que permite uma página de detalhe ter cinco formulários sem
 * virar uma parede de inputs.
 */
export function FormSection({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="grid gap-6 border-b border-panel-line py-8 last:border-b-0 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-4">
        <h2 className="display text-[1.0625rem] text-warm-white">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-ash">{description}</p>
        ) : null}
      </div>
      <div className="lg:col-span-8">
        {children}
        {footer ? <div className="mt-5">{footer}</div> : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Esqueleto de carregamento                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reserva o espaço exato do conteúdo que está vindo. O objetivo não é
 * "mostrar que está carregando" — é impedir que a página pule quando o
 * conteúdo chegar.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded-[3px] ${className}`} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Placeholder de página inteira, com o aviso para leitor de tela. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div>
      <p role="status" className="sr-only">
        Carregando…
      </p>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-64" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Notificações                                                              */
/* -------------------------------------------------------------------------- */

/**
 * `role="alert"` no erro (interrompe o leitor de tela — é urgente) e
 * `role="status"` no sucesso (espera a pausa — não é). Trocar os dois faz o
 * leitor de tela gritar confirmações e engolir erros.
 */
export function ErrorNotice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="fade-in flex items-start gap-2.5 rounded-[3px] border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-300"
    >
      <span aria-hidden="true" className="mt-px font-medium">
        !
      </span>
      <span>{message}</span>
    </p>
  );
}

export function SuccessNotice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="fade-in flex items-start gap-2.5 rounded-[3px] border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm leading-relaxed text-emerald-300"
    >
      <span aria-hidden="true" className="mt-px font-medium">
        ✓
      </span>
      <span>{message}</span>
    </p>
  );
}

/** Aviso neutro: nem erro, nem sucesso. Contexto que a pessoa precisa saber. */
export function InfoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[3px] border border-panel-line bg-panel-hi px-4 py-3 text-sm leading-relaxed text-ash">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tabela                                                                    */
/* -------------------------------------------------------------------------- */

export type DataTableColumn<T> = {
  key: string;
  header: string;
  /** Célula no desktop. */
  cell: (row: T) => ReactNode;
  /** Esconde a coluna abaixo de lg — para dados secundários. */
  hideBelowLg?: boolean;
  align?: "left" | "right";
};

/**
 * Tabela no desktop, lista de cartões no celular — o MESMO dado, renderizado
 * duas vezes a partir da mesma definição de colunas.
 *
 * Uma tabela com rolagem horizontal no celular é o caminho fácil e é ruim:
 * obriga a arrastar para ler uma linha inteira, e a primeira coluna some. Aqui
 * o celular recebe cartões (`mobileCard`), que é como esse dado quer ser lido
 * numa tela estreita.
 *
 * `<caption>` na sr-only porque uma tabela sem legenda faz o leitor de tela
 * anunciar só "tabela, 6 linhas, 4 colunas".
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  mobileCard,
  empty,
}: {
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  mobileCard: (row: T) => ReactNode;
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <>
      {/* celular */}
      <ul className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>{mobileCard(row)}</li>
        ))}
      </ul>

      {/* desktop */}
      <div className="hidden overflow-hidden rounded-[3px] border border-panel-line lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-panel-line bg-panel-hi">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`label-eyebrow px-5 py-3.5 font-medium text-ash ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${col.hideBelowLg ? "hidden xl:table-cell" : ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-panel-line bg-panel transition-colors duration-200 last:border-b-0 hover:bg-panel-hi"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-4 align-middle text-sm text-warm-white ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${col.hideBelowLg ? "hidden xl:table-cell" : ""}`}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Par rótulo/valor — usado nos cartões do celular e nas páginas de detalhe. */
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-panel-line py-3 last:border-b-0">
      <dt className="label-eyebrow text-ash">{label}</dt>
      <dd className="min-w-0 text-sm text-warm-white">{children}</dd>
    </div>
  );
}
