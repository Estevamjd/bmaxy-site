import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminContent } from "@/content/admin";
import type { PlatformLocale } from "@/content/platform";
import { requireAdmin } from "@/lib/auth/session";
import { DetailRow, EmptyState, FormSection, InfoNotice, PageHeader, Panel, StatusBadge } from "@/components/platform/ui";
import { IconInbox } from "@/components/platform/icons";
import { getStudentById, listCoursesForAdmin } from "@/lib/dal/admin";
import { EditNameForm, EnrollForm, ResendResetButton, RevokeForm } from "./StudentDetailActions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const auth = await requireAdmin("/admin/alunos");
  const { id } = await params;
  const student = await getStudentById(id, auth.locale);
  return { title: student?.fullName || student?.email || adminContent[auth.locale].meta.studentFallback };
}

function formatDateTime(iso: string, locale: PlatformLocale): string {
  return new Date(iso).toLocaleString(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("/admin/alunos");
  const copy = adminContent[auth.locale];
  const text = copy.students.detail;
  const { id } = await params;
  const [student, courses] = await Promise.all([
    getStudentById(id, auth.locale),
    listCoursesForAdmin(),
  ]);
  if (!student) notFound();

  const active = student.enrollments.filter((enrollment) => enrollment.status === "active");
  const revoked = student.enrollments.filter((enrollment) => enrollment.status === "revoked");
  const activeCourseIds = new Set(active.map((enrollment) => enrollment.courseId));
  const availableCourses = courses
    .filter((course) => !activeCourseIds.has(course.id))
    .map((course) => ({ id: course.id, title: auth.locale === "en" ? course.titleEn : course.titlePt }));

  return (
    <div>
      <PageHeader
        eyebrow={copy.common.student}
        title={student.fullName || student.email || copy.common.notNamed}
        description={student.email}
        backHref="/admin/alunos"
        backLabel={text.back}
        actions={
          <>
            {!student.emailConfirmedAt ? <StatusBadge tone="warning">{text.emailUnconfirmed}</StatusBadge> : null}
            {student.mustChangePassword ? <StatusBadge tone="pending">{text.temporaryPassword}</StatusBadge> : null}
            <StatusBadge tone={active.length > 0 ? "success" : "muted"}>{active.length > 0 ? text.hasAccess : text.noEnrollment}</StatusBadge>
          </>
        }
      />

      <section className="mt-8">
        <h2 className="sr-only">{text.accountData}</h2>
        <Panel className="px-5 py-1">
          <dl>
            <DetailRow label={copy.common.email}>{student.email}</DetailRow>
            <DetailRow label={text.created}>{formatDateTime(student.createdAt, auth.locale)}</DetailRow>
            <DetailRow label={text.emailConfirmed}>
              {student.emailConfirmedAt ? formatDateTime(student.emailConfirmedAt, auth.locale) : <span className="text-ash">{copy.common.notYet}</span>}
            </DetailRow>
            <DetailRow label={text.activeEnrollmentsCount}>{active.length}</DetailRow>
          </dl>
        </Panel>
        {!student.emailConfirmedAt ? <div className="mt-3"><InfoNotice>{text.unconfirmedNotice}</InfoNotice></div> : null}
      </section>

      <div className="mt-10">
        <FormSection title={text.studentData} description={text.studentDataDescription}>
          <EditNameForm userId={student.id} fullName={student.fullName} content={copy} />
        </FormSection>
        <FormSection title={text.accessAndPassword} description={text.accessAndPasswordDescription}>
          <ResendResetButton email={student.email} content={copy} />
        </FormSection>
        <FormSection title={text.grantCourse} description={text.grantCourseDescription}>
          <EnrollForm userId={student.id} availableCourses={availableCourses} content={copy} />
        </FormSection>
      </div>

      <section className="mt-10">
        <h2 className="display text-[1.125rem] text-warm-white">{text.activeEnrollments}</h2>
        <div className="mt-4">
          {active.length === 0 ? (
            <EmptyState compact icon={<IconInbox className="h-6 w-6" />} title={text.noCourse} description={text.noCourseDescription} />
          ) : (
            <Panel>
              <ul>
                {active.map((enrollment) => (
                  <li key={enrollment.enrollmentId} className="flex flex-wrap items-center justify-between gap-4 border-b border-panel-line px-5 py-4 last:border-b-0">
                    <div className="min-w-0"><p className="truncate text-sm text-warm-white">{enrollment.courseTitle}</p><p className="text-xs text-ash">/{enrollment.courseSlug}</p></div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge tone="success">{copy.common.active}</StatusBadge>
                      <RevokeForm enrollmentId={enrollment.enrollmentId} userId={student.id} courseTitle={enrollment.courseTitle} content={copy} />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </section>

      {revoked.length > 0 ? (
        <section className="mt-10">
          <h2 className="display text-[1.125rem] text-warm-white">{text.revokedAccess}</h2>
          <p className="mt-2 text-sm text-ash">{text.revokedDescription}</p>
          <Panel className="mt-4">
            <ul>
              {revoked.map((enrollment) => (
                <li key={enrollment.enrollmentId} className="flex flex-wrap items-center justify-between gap-4 border-b border-panel-line px-5 py-4 last:border-b-0">
                  <div className="min-w-0"><p className="truncate text-sm text-ash">{enrollment.courseTitle}</p><p className="text-xs text-ash">/{enrollment.courseSlug}</p></div>
                  <StatusBadge tone="muted">{copy.common.revoked}</StatusBadge>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}
