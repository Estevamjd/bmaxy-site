import Link from "next/link";
import { IconCheck, IconClock, IconLock, IconPlay } from "@/components/platform/icons";
import { StatusBadge } from "@/components/platform/ui";
import { formatDuration, type LessonState } from "@/lib/dal/course-progress";

/**
 * A trilha de aulas. A MESMA peça serve a página do curso e a lateral da
 * página da aula — é o que faz as duas concordarem sobre o que está liberado.
 *
 * Cada estado tem ícone E texto, nunca só cor: "concluída" e "bloqueada" não
 * podem depender de verde contra cinza para serem distinguidas.
 *
 * Aula bloqueada não é link. Também não é um link desabilitado com
 * `pointer-events: none` — isso continua no caminho do Tab e confunde quem
 * navega por teclado. É um <div>, e o motivo do bloqueio está escrito.
 */

export type LessonListItem = {
  id: string;
  title: string;
  orderIndex: number;
  durationSeconds: number | null;
  state: LessonState;
};

export type LessonListLabels = {
  lesson: string;
  continueHere: string;
  lockedBody: string;
  noVideoBody: string;
  statuses: Record<LessonState, string>;
};

const STATE_STYLE: Record<
  LessonState,
  { tone: Parameters<typeof StatusBadge>[0]["tone"]; clickable: boolean }
> = {
  completed: { tone: "success", clickable: true },
  available: { tone: "active", clickable: true },
  locked: { tone: "muted", clickable: false },
  coming_soon: { tone: "pending", clickable: false },
  no_video: { tone: "muted", clickable: false },
};

function StateIcon({ state }: { state: LessonState }) {
  const className = "h-4 w-4";
  if (state === "completed")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-400/10 text-emerald-300">
        <IconCheck className={className} />
      </span>
    );
  if (state === "available")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
        <IconPlay className={className} />
      </span>
    );
  if (state === "coming_soon")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-hi/35 bg-violet-hi/10 text-violet-hi">
        <IconClock className={className} />
      </span>
    );
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-panel-line bg-panel-hi text-ash">
      <IconLock className={className} />
    </span>
  );
}

export function LessonRow({
  lesson,
  number,
  isCurrent = false,
  isNext = false,
  compact = false,
  labels,
}: {
  lesson: LessonListItem;
  /** Posição no curso inteiro, não dentro do módulo. */
  number: number;
  isCurrent?: boolean;
  /** Marca a aula que o aluno deve assistir agora. */
  isNext?: boolean;
  compact?: boolean;
  labels: LessonListLabels;
}) {
  const meta = STATE_STYLE[lesson.state];
  const duration = formatDuration(lesson.durationSeconds);

  const inner = (
    <div className={`flex items-center gap-4 ${compact ? "px-3 py-3" : "px-4 py-4 md:px-5"}`}>
      <StateIcon state={lesson.state} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="label-eyebrow text-ash">
            {labels.lesson} {String(number).padStart(2, "0")}
          </span>
          {isNext ? (
            <span className="label-eyebrow text-gold">· {labels.continueHere}</span>
          ) : null}
        </div>
        <p
          className={`mt-1 truncate text-sm ${
            meta.clickable ? "text-warm-white" : "text-ash"
          } ${compact ? "" : "md:text-[0.9375rem]"}`}
        >
          {lesson.title}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {duration && !compact ? (
          <span className="hidden font-sans text-xs text-ash sm:inline">{duration}</span>
        ) : null}
        <StatusBadge tone={meta.tone}>{labels.statuses[lesson.state]}</StatusBadge>
      </div>
    </div>
  );

  if (!meta.clickable) {
    return (
      <li
        className={`border-b border-panel-line last:border-b-0 ${
          isCurrent ? "bg-panel-hi" : ""
        }`}
      >
        {inner}
        {lesson.state === "locked" ? (
          <p className={`pb-3 text-xs text-ash ${compact ? "px-3" : "px-4 md:px-5"}`}>
            {labels.lockedBody}
          </p>
        ) : null}
        {lesson.state === "no_video" ? (
          <p className={`pb-3 text-xs text-ash ${compact ? "px-3" : "px-4 md:px-5"}`}>
            {labels.noVideoBody}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <li className="border-b border-panel-line last:border-b-0">
      <Link
        href={`/aluno/aula/${lesson.id}`}
        aria-current={isCurrent ? "page" : undefined}
        className={`relative block transition-colors duration-200 hover:bg-panel-hi ${
          isCurrent ? "bg-panel-hi" : ""
        }`}
      >
        {isCurrent ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gold"
          />
        ) : null}
        {inner}
      </Link>
    </li>
  );
}

export function ModuleSection({
  title,
  lessons,
  numberOffset,
  currentLessonId,
  nextLessonId,
  compact = false,
  labels,
}: {
  title: string;
  lessons: LessonListItem[];
  /** Quantas aulas vieram nos módulos anteriores — a numeração é do CURSO. */
  numberOffset: number;
  currentLessonId?: string;
  nextLessonId?: string | null;
  compact?: boolean;
  labels: LessonListLabels;
}) {
  const done = lessons.filter((l) => l.state === "completed").length;

  return (
    <section className="overflow-hidden rounded-[3px] border border-panel-line bg-panel">
      <div className="flex items-center justify-between gap-4 border-b border-panel-line bg-panel-hi px-4 py-3 md:px-5">
        <h3 className="display truncate text-[0.9375rem] text-warm-white">{title}</h3>
        <span className="shrink-0 font-sans text-xs text-ash">
          {done}/{lessons.length}
        </span>
      </div>
      <ol>
        {lessons.map((lesson, index) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            number={numberOffset + index + 1}
            isCurrent={lesson.id === currentLessonId}
            isNext={lesson.id === nextLessonId}
            compact={compact}
            labels={labels}
          />
        ))}
      </ol>
    </section>
  );
}
