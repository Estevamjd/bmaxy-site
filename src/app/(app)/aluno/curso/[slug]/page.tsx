import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { IconInbox } from "@/components/platform/icons";
import { ModuleSection, type LessonListItem } from "@/components/platform/LessonList";
import {
  ButtonLink,
  EmptyState,
  InfoNotice,
  PageHeader,
  Panel,
  ProgressBar,
} from "@/components/platform/ui";
import { summarizeCourse } from "@/lib/dal/course-progress";
import { getMyCourseBySlug } from "@/lib/dal/student";
import { requireStudent } from "@/lib/auth/session";
import { studentContent } from "@/content/student";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getMyCourseBySlug(slug);
  const auth = await requireStudent(`/aluno/curso/${slug}`);
  const copy = studentContent[auth.locale];
  return {
    title: detail
      ? auth.locale === "en"
        ? detail.course.titleEn
        : detail.course.titlePt
      : copy.meta.course,
  };
}

export default async function StudentCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [detail, auth] = await Promise.all([
    getMyCourseBySlug(slug),
    requireStudent(`/aluno/curso/${slug}`),
  ]);

  // RLS já garante que só chega aqui um curso publicado com matrícula ativa —
  // se voltar vazio, ou o curso não existe, ou o aluno não tem acesso. Os dois
  // viram 404 (não revela qual dos dois é).
  if (!detail) notFound();

  const copy = studentContent[auth.locale];
  const courseTitle = auth.locale === "en" ? detail.course.titleEn : detail.course.titlePt;
  const courseDescription = auth.locale === "en"
    ? detail.course.descriptionEn
    : detail.course.descriptionPt;

  const orderedLessons = detail.modules.flatMap((m) => m.lessons);
  const summary = summarizeCourse(orderedLessons, detail.progress);

  /* A numeração é do CURSO inteiro, não do módulo: "Aula 01" reiniciando a
     cada módulo faz duas aulas diferentes terem o mesmo nome. */
  let offset = 0;
  const modulesWithOffset = detail.modules.map((module) => {
    const start = offset;
    offset += module.lessons.length;
    return { module, start };
  });

  const toListItem = (lesson: (typeof orderedLessons)[number]): LessonListItem => ({
    id: lesson.id,
    title: auth.locale === "en" ? lesson.titleEn : lesson.titlePt,
    orderIndex: lesson.orderIndex,
    durationSeconds: lesson.durationSeconds,
    state: summary.stateById.get(lesson.id) ?? "locked",
  });

  return (
    <div>
      <PageHeader
        eyebrow={copy.course.eyebrow}
        title={courseTitle}
        description={courseDescription || undefined}
        backHref="/aluno"
        backLabel={copy.course.back}
        actions={
          summary.nextLesson ? (
            <ButtonLink href={`/aluno/aula/${summary.nextLesson.id}`} tone="primary">
              {copy.course.continue}
            </ButtonLink>
          ) : undefined
        }
      />

      {/* ----------------------------- progresso ----------------------------- */}
      <Panel className="mt-8 p-6 md:p-7">
        <div className="grid gap-6 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <ProgressBar
              value={summary.completedCount}
              max={summary.publishedCount}
              label={copy.course.lessonsCompleted}
              ofLabel={copy.progressOf}
            />
          </div>
          <dl className="grid grid-cols-3 gap-4 md:col-span-5">
            <div>
              <dt className="label-eyebrow text-ash">{copy.course.published}</dt>
              <dd className="display mt-1.5 text-xl text-warm-white">
                {summary.publishedCount}
              </dd>
            </div>
            <div>
              <dt className="label-eyebrow text-ash">{copy.course.completed}</dt>
              <dd className="display mt-1.5 text-xl text-warm-white">
                {summary.completedCount}
              </dd>
            </div>
            <div>
              <dt className="label-eyebrow text-ash">{copy.course.comingSoon}</dt>
              <dd className="display mt-1.5 text-xl text-warm-white">
                {summary.comingSoonCount}
              </dd>
            </div>
          </dl>
        </div>
      </Panel>

      {/* ------------------------------ trilha ------------------------------- */}
      <div className="mt-10">
        <h2 className="display text-[1.125rem] text-warm-white">{copy.course.track}</h2>
        <p className="mt-2 text-sm text-ash">
          {copy.course.sequence}
        </p>

        {orderedLessons.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              compact
              icon={<IconInbox className="h-6 w-6" />}
              title={copy.course.emptyTitle}
              description={copy.course.emptyBody}
            />
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {modulesWithOffset.map(({ module, start }) => (
              <ModuleSection
                key={module.id}
                title={auth.locale === "en" ? module.titleEn : module.titlePt}
                lessons={module.lessons.map(toListItem)}
                numberOffset={start}
                nextLessonId={summary.nextLesson?.id ?? null}
                labels={copy.lessonList}
              />
            ))}
          </div>
        )}
      </div>

      {summary.comingSoonCount > 0 ? (
        <div className="mt-8">
          <InfoNotice>
            {summary.comingSoonCount === 1
              ? copy.course.announcedOne
              : copy.course.announcedMany(summary.comingSoonCount)}{" "}
            {copy.course.announcedTail}
          </InfoNotice>
        </div>
      ) : null}
    </div>
  );
}
