import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminContent, formatAdminMessage } from "@/content/admin";
import { requireAdmin } from "@/lib/auth/session";
import { IconInbox, IconVideo } from "@/components/platform/icons";
import {
  EmptyState,
  FormSection,
  MetricCard,
  MetricGrid,
  PageHeader,
  Panel,
  StatusBadge,
} from "@/components/platform/ui";
import { formatDuration } from "@/lib/dal/course-progress";
import { getCourseDetailForAdmin, type AdminLessonDetail } from "@/lib/dal/admin";
import {
  CourseStatusForm,
  CreateLessonForm,
  CreateModuleForm,
  DeleteLessonForm,
  DeleteModuleForm,
  EditCourseForm,
  EditLessonForm,
  EditModuleForm,
  LessonVideoForm,
  MoveButtons,
} from "../CourseForms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [auth, course] = await Promise.all([
    requireAdmin(`/admin/cursos/${id}`),
    getCourseDetailForAdmin(id),
  ]);
  const copy = adminContent[auth.locale];

  return {
    title:
      (course && (auth.locale === "en" ? course.titleEn : course.titlePt)) ||
      copy.meta.courseFallback,
    description:
      (course && (auth.locale === "en" ? course.descriptionEn : course.descriptionPt)) ||
      undefined,
  };
}

const LESSON_STATUS: Record<
  AdminLessonDetail["status"],
  "success" | "pending" | "muted"
> = {
  published: "success",
  coming_soon: "pending",
  draft: "muted",
};

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [auth, course] = await Promise.all([
    requireAdmin(`/admin/cursos/${id}`),
    getCourseDetailForAdmin(id),
  ]);
  if (!course) notFound();

  const copy = adminContent[auth.locale];
  const text = copy.courses.detail;
  const title = auth.locale === "en" ? course.titleEn : course.titlePt;
  const description = auth.locale === "en" ? course.descriptionEn : course.descriptionPt;
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const publishedLessons = allLessons.filter((l) => l.status === "published");
  const missingVideo = publishedLessons.filter((l) => !l.hasVideo);

  return (
    <div>
      <PageHeader
        eyebrow={copy.common.course}
        title={title}
        description={description || `/${course.slug}`}
        backHref="/admin/cursos"
        backLabel={text.back}
        actions={
          <StatusBadge tone={course.status === "published" ? "success" : "muted"}>
            {course.status === "published" ? copy.common.published : copy.common.draft}
          </StatusBadge>
        }
      />

      {/* ------------------------------ resumo ------------------------------ */}
      <section className="mt-8">
        <h2 className="sr-only">{text.summary}</h2>
        <MetricGrid columns={4}>
          <MetricCard label={text.modules} value={course.modules.length} />
          <MetricCard label={text.lessons} value={allLessons.length} />
          <MetricCard label={text.published} value={publishedLessons.length} />
          <MetricCard
            label={text.publishedWithoutVideo}
            value={missingVideo.length}
            tone="attention"
            hint={missingVideo.length > 0 ? text.emptyLessonWarning : copy.dashboard.noPending}
          />
        </MetricGrid>
        <p className="mt-3 text-xs text-ash">
          {course.activeStudentCount === 1
            ? text.activeStudentOne
            : formatAdminMessage(text.activeStudentMany, {
                count: course.activeStudentCount,
              })}
        </p>
      </section>

      {/* ------------------------------ edição ------------------------------ */}
      <div className="mt-10">
        <FormSection
          title={text.courseData}
          description={text.courseDataDescription}
        >
          <EditCourseForm
            courseId={course.id}
            titlePt={course.titlePt}
            titleEn={course.titleEn}
            descriptionPt={course.descriptionPt}
            descriptionEn={course.descriptionEn}
            content={copy}
          />
        </FormSection>

        <FormSection
          title={text.publication}
          description={text.publicationDescription}
        >
          <CourseStatusForm
            courseId={course.id}
            status={course.status}
            activeStudentCount={course.activeStudentCount}
            content={copy}
          />
        </FormSection>
      </div>

      {/* ------------------------------ conteúdo ---------------------------- */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-[1.25rem] text-warm-white">{text.content}</h2>
            <p className="mt-2 text-sm text-ash">{text.contentDescription}</p>
          </div>
          <CreateModuleForm courseId={course.id} content={copy} />
        </div>

        <div className="mt-6 space-y-6">
          {course.modules.length === 0 ? (
            <EmptyState
              icon={<IconInbox className="h-6 w-6" />}
              title={text.noModule}
              description={text.noModuleDescription}
            />
          ) : (
            course.modules.map((module, moduleIndex) => (
              <Panel key={module.id} as="section" className="overflow-hidden">
                {/* ------------------------ cabeçalho do módulo ------------- */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-panel-line bg-panel-hi px-5 py-4">
                  <div className="min-w-0">
                    <p className="label-eyebrow text-ash">
                      {text.module} {String(moduleIndex + 1).padStart(2, "0")}
                    </p>
                    <h3 className="display mt-1 truncate text-[1.0625rem] text-warm-white">
                      {auth.locale === "en" ? module.titleEn : module.titlePt}
                    </h3>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <MoveButtons
                      kind="module"
                      id={module.id}
                      courseId={course.id}
                      isFirst={moduleIndex === 0}
                      isLast={moduleIndex === course.modules.length - 1}
                      content={copy}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 border-b border-panel-line px-5 py-3">
                  <EditModuleForm
                    moduleId={module.id}
                    courseId={course.id}
                    titlePt={module.titlePt}
                    titleEn={module.titleEn}
                    content={copy}
                  />
                  <CreateLessonForm moduleId={module.id} courseId={course.id} content={copy} />
                  <DeleteModuleForm
                    moduleId={module.id}
                    courseId={course.id}
                    title={auth.locale === "en" ? module.titleEn : module.titlePt}
                    lessonCount={module.lessons.length}
                    content={copy}
                  />
                </div>

                {/* ---------------------------- aulas ----------------------- */}
                {module.lessons.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-ash">
                    {text.noLesson}
                  </p>
                ) : (
                  <ol>
                    {module.lessons.map((lesson, lessonIndex) => {
                      const statusTone = LESSON_STATUS[lesson.status];
                      const duration = formatDuration(lesson.durationSeconds);
                      const needsVideo = lesson.status === "published" && !lesson.hasVideo;

                      return (
                        <li
                          key={lesson.id}
                          className="border-b border-panel-line px-5 py-4 last:border-b-0"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="label-eyebrow text-ash">
                                  {text.lesson} {String(lessonIndex + 1).padStart(2, "0")}
                                </span>
                                <StatusBadge tone={statusTone}>
                                  {text.lessonStatuses[lesson.status]}
                                </StatusBadge>
                                <StatusBadge tone={lesson.hasVideo ? "success" : "muted"}>
                                  <IconVideo className="h-3 w-3" />
                                  {lesson.hasVideo ? text.withVideo : text.withoutVideo}
                                </StatusBadge>
                                {duration ? (
                                  <span className="text-xs text-ash">{duration}</span>
                                ) : null}
                              </div>
                              <p className="mt-1.5 truncate text-sm text-warm-white">
                                {auth.locale === "en" ? lesson.titleEn : lesson.titlePt}
                              </p>

                              {/* Aviso onde a decisão é tomada, não numa tela
                                  de resumo distante. */}
                              {needsVideo ? (
                                <p className="mt-2 text-xs leading-relaxed text-amber-300">
                                  {text.publishedEmptyWarning}
                                </p>
                              ) : null}
                            </div>

                            <MoveButtons
                              kind="lesson"
                              id={lesson.id}
                              courseId={course.id}
                              isFirst={lessonIndex === 0}
                              isLast={lessonIndex === module.lessons.length - 1}
                              content={copy}
                            />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-3">
                            <EditLessonForm
                              lessonId={lesson.id}
                              courseId={course.id}
                              titlePt={lesson.titlePt}
                              titleEn={lesson.titleEn}
                              descriptionPt={lesson.descriptionPt}
                              descriptionEn={lesson.descriptionEn}
                              status={lesson.status}
                              durationSeconds={lesson.durationSeconds}
                              hasVideo={lesson.hasVideo}
                              content={copy}
                            />
                            <LessonVideoForm
                              lessonId={lesson.id}
                              courseId={course.id}
                              hasVideo={lesson.hasVideo}
                              content={copy}
                            />
                            <DeleteLessonForm
                              lessonId={lesson.id}
                              courseId={course.id}
                              title={auth.locale === "en" ? lesson.titleEn : lesson.titlePt}
                              content={copy}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Panel>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
