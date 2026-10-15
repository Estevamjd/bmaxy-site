import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { IconArrowRight, IconChevronDown, IconChevronLeft } from "@/components/platform/icons";
import { ModuleSection, type LessonListItem } from "@/components/platform/LessonList";
import { LessonPlayer, LockedLessonNotice } from "@/components/platform/LessonPlayer";
import { InfoNotice, ProgressBar, StatusBadge } from "@/components/platform/ui";
import { formatDuration, summarizeCourse } from "@/lib/dal/course-progress";
import { getLessonPlayback, getMyLessonById } from "@/lib/dal/student";
import { requireStudent } from "@/lib/auth/session";
import { studentContent } from "@/content/student";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}): Promise<Metadata> {
  const { lessonId } = await params;
  const detail = await getMyLessonById(lessonId);
  const auth = await requireStudent(`/aluno/aula/${lessonId}`);
  return {
    title: detail
      ? auth.locale === "en"
        ? detail.lesson.titleEn
        : detail.lesson.titlePt
      : studentContent[auth.locale].meta.lesson,
  };
}

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const [detail, auth] = await Promise.all([
    getMyLessonById(lessonId),
    requireStudent(`/aluno/aula/${lessonId}`),
  ]);

  if (!detail) notFound();

  const copy = studentContent[auth.locale];
  const titleFor = (item: { titlePt: string; titleEn: string }) =>
    auth.locale === "en" ? item.titleEn : item.titlePt;

  const { course, lesson, courseLessons, allProgress } = detail;

  // courseLessons já vem ordenada (módulo, depois aula dentro do módulo) — não
  // reordenar por orderIndex sozinho, que só é único DENTRO de um módulo.
  const summary = summarizeCourse(courseLessons, allProgress);
  const state = summary.stateById.get(lesson.id) ?? "locked";
  const unlocked = state !== "locked";
  const progress = allProgress.find((p) => p.lessonId === lesson.id) ?? null;

  // O video_id só é buscado aqui, e só pela função segura do banco. Se a aula
  // estiver bloqueada, `getLessonPlayback` devolve null sem nem consultar — e,
  // se consultasse, get_lesson_playback() barraria. O navegador nunca recebe o
  // id de uma aula que a pessoa não pode assistir.
  const playback = await getLessonPlayback(lesson, unlocked);

  const index = courseLessons.findIndex((l) => l.id === lesson.id);
  const previousLesson = index > 0 ? courseLessons[index - 1] : null;
  const nextLesson =
    index >= 0 && index < courseLessons.length - 1 ? courseLessons[index + 1] : null;
  const nextIsOpen = nextLesson ? summary.stateById.get(nextLesson.id) !== "locked" : false;

  const duration = formatDuration(lesson.durationSeconds);

  /* A lateral é o curso inteiro. Agrupar por módulo aqui exigiria os módulos,
     que esta consulta não traz — então a lista vem como um bloco só, com a
     numeração do curso, que é o que importa para se localizar. */
  const sidebarLessons: LessonListItem[] = courseLessons.map((l) => ({
    id: l.id,
    title: titleFor(l),
    orderIndex: l.orderIndex,
    durationSeconds: l.durationSeconds,
    state: summary.stateById.get(l.id) ?? "locked",
  }));

  const courseList = (
    <ModuleSection
      title={titleFor(course)}
      lessons={sidebarLessons}
      numberOffset={0}
      currentLessonId={lesson.id}
      nextLessonId={summary.nextLesson?.id ?? null}
      compact
      labels={copy.lessonList}
    />
  );

  return (
    <div>
      <Link
        href={`/aluno/curso/${course.slug}`}
        className="group -ml-1 inline-flex min-h-9 items-center gap-1.5 px-1 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ash transition-colors duration-200 hover:text-warm-white"
      >
        <IconChevronLeft className="h-4 w-4" />
        <span className="link-underline">{titleFor(course)}</span>
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:gap-8">
        {/* ------------------------------ principal ------------------------- */}
        <div className="lg:col-span-8">
          {unlocked ? (
            <LessonPlayer
              lessonId={lesson.id}
              playback={playback}
              status={lesson.status}
              completed={progress?.completed ?? false}
              labels={copy.player}
            />
          ) : (
            <LockedLessonNotice labels={copy.player} />
          )}

          <div className="mt-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="label-eyebrow text-gold">
                {copy.lesson.lesson} {String(index + 1).padStart(2, "0")}
              </span>
              {duration ? <span className="text-xs text-ash">· {duration}</span> : null}
              {state === "completed" ? (
                <StatusBadge tone="success">{copy.lesson.status.completed}</StatusBadge>
              ) : state === "coming_soon" ? (
                <StatusBadge tone="pending">{copy.lesson.status.comingSoon}</StatusBadge>
              ) : state === "locked" ? (
                <StatusBadge tone="muted">{copy.lesson.status.locked}</StatusBadge>
              ) : state === "no_video" ? (
                <StatusBadge tone="muted">{copy.lesson.status.noVideo}</StatusBadge>
              ) : (
                <StatusBadge tone="active">{copy.lesson.status.available}</StatusBadge>
              )}
            </div>

            <h1 className="display mt-3 text-[1.5rem] leading-tight text-warm-white md:text-[2rem]">
              {titleFor(lesson)}
            </h1>

            {(auth.locale === "en" ? lesson.descriptionEn : lesson.descriptionPt) ? (
              <p className="measure mt-4 text-[0.9375rem] leading-relaxed text-ash">
                {auth.locale === "en" ? lesson.descriptionEn : lesson.descriptionPt}
              </p>
            ) : null}
          </div>

          {/* Explica o estado quando não dá para assistir. */}
          {state === "coming_soon" ? (
            <div className="mt-6">
              <InfoNotice>
                {copy.lesson.comingSoonBody}
              </InfoNotice>
            </div>
          ) : null}
          {state === "no_video" ? (
            <div className="mt-6">
              <InfoNotice>
                {copy.lesson.noVideoBody}
              </InfoNotice>
            </div>
          ) : null}

          {/* ------------------------- anterior / próxima ------------------- */}
          <nav
            aria-label={copy.lesson.navigation}
            className="mt-10 grid gap-3 border-t border-panel-line pt-6 sm:grid-cols-2"
          >
            {previousLesson ? (
              <Link
                href={`/aluno/aula/${previousLesson.id}`}
                className="group flex items-center gap-3 rounded-[3px] border border-panel-line bg-panel p-4 transition-colors duration-200 hover:border-ash hover:bg-panel-hi"
              >
                <IconChevronLeft className="h-5 w-5 shrink-0 text-ash" />
                <span className="min-w-0">
                  <span className="label-eyebrow block text-ash">{copy.lesson.previous}</span>
                  <span className="mt-1 block truncate text-sm text-warm-white">
                    {titleFor(previousLesson)}
                  </span>
                </span>
              </Link>
            ) : (
              <span />
            )}

            {nextLesson ? (
              nextIsOpen ? (
                <Link
                  href={`/aluno/aula/${nextLesson.id}`}
                  className="group flex items-center justify-end gap-3 rounded-[3px] border border-panel-line bg-panel p-4 text-right transition-colors duration-200 hover:border-ash hover:bg-panel-hi"
                >
                  <span className="min-w-0">
                    <span className="label-eyebrow block text-ash">{copy.lesson.next}</span>
                    <span className="mt-1 block truncate text-sm text-warm-white">
                      {titleFor(nextLesson)}
                    </span>
                  </span>
                  <IconArrowRight className="h-5 w-5 shrink-0 text-ash" />
                </Link>
              ) : (
                <div className="flex items-center justify-end gap-3 rounded-[3px] border border-dashed border-panel-line p-4 text-right">
                  <span className="min-w-0">
                    <span className="label-eyebrow block text-ash">{copy.lesson.next}</span>
                    <span className="mt-1 block text-xs text-ash">
                      {copy.lesson.finishToUnlock}
                    </span>
                  </span>
                </div>
              )
            ) : null}
          </nav>
        </div>

        {/* ------------------------------- lateral -------------------------- */}
        <aside className="lg:col-span-4">
          {/* Desktop: fica visível o tempo todo, grudada ao rolar. */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <div className="mb-4">
                <ProgressBar
                  value={summary.completedCount}
                  max={summary.publishedCount}
                  label={copy.lesson.courseProgress}
                  ofLabel={copy.progressOf}
                />
              </div>
              <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">{courseList}</div>
            </div>
          </div>

          {/* Celular: recolhida por padrão. <details> em vez de estado no React
              — abre e fecha sem JavaScript e já vem com a semântica certa. */}
          <details className="group rounded-[3px] border border-panel-line bg-panel lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-warm-white [&::-webkit-details-marker]:hidden">
              <span>
                {copy.lesson.courseLessons}
                <span className="ml-2 text-xs text-ash">
                  {summary.completedCount}/{summary.publishedCount}
                </span>
              </span>
              <IconChevronDown className="h-5 w-5 shrink-0 text-ash transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-panel-line p-3">
              <div className="mb-3">
                <ProgressBar
                  value={summary.completedCount}
                  max={summary.publishedCount}
                  label={copy.lesson.courseProgress}
                  showText={false}
                  size="sm"
                />
              </div>
              {courseList}
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
