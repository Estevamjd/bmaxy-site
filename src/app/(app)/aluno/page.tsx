import Link from "next/link";
import type { Metadata } from "next";
import { IconBooks, IconClock, IconInbox } from "@/components/platform/icons";
import {
  ButtonLink,
  DetailRow,
  EmptyState,
  InfoNotice,
  MetricGrid,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeading,
  StatusBadge,
} from "@/components/platform/ui";
import { summarizeCourse } from "@/lib/dal/course-progress";
import { getMyCourseBySlug, listMyCourses } from "@/lib/dal/student";
import { requireStudent } from "@/lib/auth/session";
import { getResumoDoLivro } from "@/lib/dal/writing";
import { studentContent } from "@/content/student";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireStudent("/aluno");
  return { title: studentContent[auth.locale].meta.dashboard };
}

export default async function StudentDashboardPage() {
  const [auth, courses, writing] = await Promise.all([
    requireStudent("/aluno"),
    listMyCourses(),
    getResumoDoLivro(),
  ]);
  const copy = studentContent[auth.locale];
  const numberLocale = auth.locale === "en" ? "en-US" : "pt-BR";
  const firstName = auth.fullName.trim().split(" ")[0] ?? "";
  const titleFor = (item: { titlePt: string; titleEn: string }) =>
    auth.locale === "en" ? item.titleEn : item.titlePt;
  const descriptionFor = (item: { descriptionPt: string; descriptionEn: string }) =>
    auth.locale === "en" ? item.descriptionEn : item.descriptionPt;

  const details = await Promise.all(
    courses.map(async (course) => {
      const detail = await getMyCourseBySlug(course.slug);
      const orderedLessons = (detail?.modules ?? []).flatMap((m) => m.lessons);
      return {
        course,
        detail,
        summary: summarizeCourse(orderedLessons, detail?.progress ?? []),
      };
    }),
  );

  /* A última atividade só aparece se existir de verdade. Sem progresso
     nenhum, o bloco some — em vez de mostrar "nenhuma atividade ainda", que
     ocupa espaço para não dizer nada. */
  const lastActivity = details
    .flatMap(({ course, detail }) =>
      (detail?.progress ?? [])
        .filter((p) => p.completed)
        .map((p) => {
          const found = (detail?.modules ?? [])
            .flatMap((m) => m.lessons)
            .find((lesson) => lesson.id === p.lessonId);
          return {
            courseSlug: course.slug,
            lessonId: p.lessonId,
            title: found ? titleFor(found) : copy.meta.lesson,
          };
        }),
    )
    .at(-1);

  const featured = details[0];

  return (
    <div>
      <PageHeader
        eyebrow={copy.dashboard.eyebrow}
        title={copy.dashboard.greeting(firstName)}
        description={
          courses.length > 0
            ? copy.dashboard.withCourses
            : copy.dashboard.withoutCourses
        }
      />

      {courses.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<IconInbox className="h-6 w-6" />}
            title={copy.dashboard.noCourseTitle}
            description={copy.dashboard.noCourseBody}
            action={
              <ButtonLink href={auth.locale === "en" ? "/en/course" : "/curso"} tone="secondary">
                {copy.dashboard.exploreCourse}
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <>
          {/* ---------------------- curso em destaque ---------------------- */}
          {featured ? (
            <section className="mt-10" aria-labelledby="curso-destaque">
              <Panel className="overflow-hidden">
                <div className="border-b border-panel-line p-6 md:p-8">
                  <p className="label-eyebrow text-gold">{copy.dashboard.yourCourse}</p>
                  <h2
                    id="curso-destaque"
                    className="display mt-3 text-[1.5rem] text-warm-white md:text-[1.875rem]"
                  >
                    {titleFor(featured.course)}
                  </h2>
                  {descriptionFor(featured.course) ? (
                    <p className="measure mt-3 text-sm leading-relaxed text-ash">
                      {descriptionFor(featured.course)}
                    </p>
                  ) : null}

                  <div className="mt-7 max-w-md">
                    <ProgressBar
                      value={featured.summary.completedCount}
                      max={featured.summary.publishedCount}
                      label={copy.dashboard.lessonsCompleted}
                      ofLabel={copy.progressOf}
                    />
                  </div>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                    {featured.summary.nextLesson ? (
                      <ButtonLink
                        href={`/aluno/aula/${featured.summary.nextLesson.id}`}
                        tone="primary"
                      >
                        {copy.dashboard.continueLearning}
                      </ButtonLink>
                    ) : null}
                    <ButtonLink
                      href={`/aluno/curso/${featured.course.slug}`}
                      tone={featured.summary.nextLesson ? "secondary" : "primary"}
                    >
                      {copy.dashboard.fullTrack}
                    </ButtonLink>
                  </div>

                  {/* Sem próxima aula, a tela DIZ por quê. */}
                  {!featured.summary.nextLesson ? (
                    <div className="mt-6 max-w-xl">
                      <InfoNotice>
                        {featured.summary.nextLessonReason === "all_completed" ? (
                          <>
                            {copy.dashboard.allAvailableComplete}
                          </>
                        ) : featured.summary.nextLessonReason === "coming_soon" ? (
                          <>
                            {copy.dashboard.nextComingSoon}
                          </>
                        ) : (
                          <>
                            {copy.dashboard.courseBeingPublished}
                          </>
                        )}
                      </InfoNotice>
                    </div>
                  ) : null}
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-4">
                  {[
                    { label: copy.dashboard.published, value: featured.summary.publishedCount },
                    { label: copy.dashboard.completed, value: featured.summary.completedCount },
                    { label: copy.dashboard.progress, value: `${featured.summary.percent}%` },
                    { label: copy.dashboard.comingSoon, value: featured.summary.comingSoonCount },
                  ].map((item, index) => (
                    <div
                      key={item.label}
                      className={`p-5 md:p-6 ${index % 2 === 1 ? "border-l border-panel-line" : ""} ${
                        index < 2 ? "border-b border-panel-line sm:border-b-0" : ""
                      } ${index === 2 ? "sm:border-l sm:border-panel-line" : ""}`}
                    >
                      <dt className="label-eyebrow text-ash">{item.label}</dt>
                      <dd className="display mt-2 text-2xl text-warm-white">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </section>
          ) : null}

          {/* --------------------- demais cursos --------------------------- */}
          {details.length > 1 ? (
            <section className="mt-12" aria-labelledby="outros-cursos">
              <h2 id="outros-cursos" className="sr-only">
                {copy.dashboard.otherCourses}
              </h2>
              <SectionHeading title={copy.dashboard.otherCourses} as="h3" />
              <div className="mt-4">
                <MetricGrid columns={3}>
                  {details.slice(1).map(({ course, summary }) => (
                    <Link
                      key={course.id}
                      href={`/aluno/curso/${course.slug}`}
                      className="col-span-2 rounded-[3px] border border-panel-line bg-panel p-5 transition-colors duration-200 hover:border-ash hover:bg-panel-hi lg:col-span-1"
                    >
                      <span className="flex items-center gap-2 text-gold">
                        <IconBooks className="h-4 w-4" />
                        <span className="label-eyebrow">{copy.dashboard.course}</span>
                      </span>
                      <span className="display mt-3 block text-[1.0625rem] text-warm-white">
                        {titleFor(course)}
                      </span>
                      <span className="mt-4 block">
                        <ProgressBar
                          value={summary.completedCount}
                          max={summary.publishedCount}
                          label={`${copy.dashboard.progress}: ${titleFor(course)}`}
                          showText={false}
                          size="sm"
                        />
                      </span>
                      <span className="mt-2 block text-xs text-ash">
                        {copy.dashboard.completedOf(summary.completedCount, summary.publishedCount)}
                      </span>
                    </Link>
                  ))}
                </MetricGrid>
              </div>
            </section>
          ) : null}

          {/* --------------------- última atividade ------------------------ */}
          {lastActivity ? (
            <section className="mt-12">
              <SectionHeading title={copy.dashboard.lastActivity} as="h2" />
              <Panel className="mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-400/10 text-emerald-300"
                  >
                    <IconClock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-warm-white">{lastActivity.title}</p>
                    <p className="text-xs text-ash">{copy.dashboard.lessonCompleted}</p>
                  </div>
                </div>
                <ButtonLink href={`/aluno/aula/${lastActivity.lessonId}`} tone="ghost">
                  {copy.dashboard.reviewLesson}
                </ButtonLink>
              </Panel>
            </section>
          ) : null}
        </>
      )}

      <section className="mt-12">
        <SectionHeading title={writing ? copy.dashboard.writingTitle : copy.dashboard.writingEmptyTitle} as="h2" />
        <Panel className="mt-4 p-6">
          {writing ? (
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="label-eyebrow text-gold">{copy.dashboard.writingEyebrow}</p>
                <h3 className="display mt-2 text-[1.25rem] text-warm-white">{writing.title}</h3>
                <p className="mt-3 text-sm text-ash">
                  {writing.totalWords.toLocaleString(numberLocale)} {copy.dashboard.words} ·{" "}
                  {writing.chapterCount} {copy.dashboard.chapters}
                </p>
                {writing.ultimoCapitulo ? (
                  <p className="mt-2 text-sm text-ash">
                    {copy.dashboard.recentChapter}: <span className="text-warm-white">{writing.ultimoCapitulo.title}</span>
                  </p>
                ) : null}
                {writing.wordGoal ? (
                  <div className="mt-5 max-w-md">
                    <ProgressBar value={writing.totalWords} max={writing.wordGoal} label={copy.dashboard.wordGoal} ofLabel={copy.progressOf} />
                  </div>
                ) : null}
              </div>
              <ButtonLink href="/aluno/meu-livro" tone="primary">{copy.dashboard.openStudio}</ButtonLink>
            </div>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="measure text-sm leading-relaxed text-ash">{copy.dashboard.writingEmptyBody}</p>
              <ButtonLink href="/aluno/meu-livro" tone="primary">{copy.dashboard.openStudio}</ButtonLink>
            </div>
          )}
        </Panel>
      </section>

      {/* ------------------------------ perfil ------------------------------ */}
      <section className="mt-12">
        <SectionHeading title={copy.dashboard.profile} description={copy.dashboard.profileBody} as="h2" />
        <Panel className="mt-4 px-5 py-1">
          <dl>
            <DetailRow label={copy.dashboard.name}>
              {auth.fullName || <span className="text-ash">{copy.dashboard.noName}</span>}
            </DetailRow>
            <DetailRow label={copy.dashboard.email}>{auth.email ?? "—"}</DetailRow>
            <DetailRow label={copy.dashboard.language}>{copy.dashboard.languageValue}</DetailRow>
            <DetailRow label={copy.dashboard.access}>
              <StatusBadge tone="success">{copy.dashboard.active}</StatusBadge>
            </DetailRow>
          </dl>
        </Panel>
        <p className="mt-3 text-xs leading-relaxed text-ash">
          {copy.dashboard.profileNotePrefix}{" "}
          <Link href="/recuperar-senha" className="text-gold hover:text-gold-hi">
            {copy.dashboard.resetPassword}
          </Link>
          {copy.dashboard.profileNoteSuffix}
        </p>
      </section>
    </div>
  );
}
