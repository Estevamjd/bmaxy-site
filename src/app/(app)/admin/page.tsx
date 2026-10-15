import Link from "next/link";
import type { Metadata } from "next";
import { adminContent, formatAdminMessage } from "@/content/admin";
import type { PlatformLocale } from "@/content/platform";
import { requireAdmin } from "@/lib/auth/session";
import { IconBooks, IconInbox, IconPlus, IconUsers, IconVideo } from "@/components/platform/icons";
import {
  ButtonLink,
  EmptyState,
  MetricCard,
  MetricGrid,
  PageHeader,
  Panel,
  SectionHeading,
  StatusBadge,
} from "@/components/platform/ui";
import { getAdminDashboardStats } from "@/lib/dal/admin";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireAdmin("/admin");
  return { title: adminContent[auth.locale].meta.dashboard };
}

function shortDate(iso: string, locale: PlatformLocale): string {
  const copy = adminContent[locale].common;
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return copy.today;
  if (days === 1) return copy.yesterday;
  if (days < 7) return formatAdminMessage(copy.daysAgo, { count: days });
  return date.toLocaleDateString(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default async function AdminDashboardPage() {
  const auth = await requireAdmin("/admin");
  const copy = adminContent[auth.locale].dashboard;
  const stats = await getAdminDashboardStats(auth.locale);
  const publishedHint =
    stats.publishedCourses === 1
      ? copy.publishedCourseOne
      : formatAdminMessage(copy.publishedCourseMany, { count: stats.publishedCourses });
  const shortcuts = [
    { href: "/admin/alunos/novo", icon: IconPlus, ...copy.shortcutsItems.createStudent },
    { href: "/admin/alunos", icon: IconUsers, ...copy.shortcutsItems.manageStudents },
    { href: "/admin/cursos", icon: IconBooks, ...copy.shortcutsItems.manageCourses },
    { href: "/admin/cursos", icon: IconVideo, ...copy.shortcutsItems.manageContent },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <ButtonLink href="/admin/alunos/novo" tone="primary">{copy.createStudent}</ButtonLink>
            <ButtonLink href="/admin/cursos" tone="secondary">{copy.manageCourses}</ButtonLink>
          </>
        }
      />

      <section className="mt-8">
        <h2 className="sr-only">{copy.metrics}</h2>
        <MetricGrid columns={4}>
          <MetricCard label={copy.students} value={stats.studentCount} href="/admin/alunos" />
          <MetricCard label={copy.activeEnrollments} value={stats.activeEnrollments} hint={copy.activeEnrollmentsHint} />
          <MetricCard label={copy.courses} value={stats.courseCount} hint={publishedHint} href="/admin/cursos" />
          <MetricCard label={copy.publishedLessons} value={stats.publishedLessons} hint={copy.publishedLessonsHint} />
        </MetricGrid>
        <div className="mt-3">
          <MetricGrid columns={3}>
            <MetricCard label={copy.comingSoonLessons} value={stats.comingSoonLessons} hint={copy.comingSoonHint} />
            <MetricCard
              label={copy.withoutVideo}
              value={stats.lessonsWithoutVideo}
              tone="attention"
              hint={stats.lessonsWithoutVideo > 0 ? copy.withoutVideoAttention : copy.noPending}
            />
            <MetricCard label={copy.publishedCourses} value={stats.publishedCourses} hint={copy.publishedCoursesHint} />
          </MetricGrid>
        </div>
      </section>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading
            title={copy.recentStudents}
            as="h2"
            actions={stats.recentStudents.length > 0 ? <ButtonLink href="/admin/alunos" tone="ghost">{copy.seeAll}</ButtonLink> : undefined}
          />
          <div className="mt-4">
            {stats.recentStudents.length === 0 ? (
              <EmptyState
                compact
                icon={<IconUsers className="h-6 w-6" />}
                title={copy.noStudents}
                description={copy.noStudentsDescription}
                action={<ButtonLink href="/admin/alunos/novo" tone="secondary">{copy.createStudent}</ButtonLink>}
              />
            ) : (
              <Panel>
                <ul>
                  {stats.recentStudents.map((student) => (
                    <li key={student.id} className="border-b border-panel-line last:border-b-0">
                      <Link href={`/admin/alunos/${student.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors duration-200 hover:bg-panel-hi">
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-warm-white">{student.fullName || student.email}</span>
                          <span className="block truncate text-xs text-ash">{student.email} · {shortDate(student.createdAt, auth.locale)}</span>
                        </span>
                        {!student.emailConfirmedAt ? (
                          <StatusBadge tone="warning">{copy.emailPending}</StatusBadge>
                        ) : student.activeEnrollments > 0 ? (
                          <StatusBadge tone="success">{copy.hasAccess}</StatusBadge>
                        ) : (
                          <StatusBadge tone="muted">{copy.noEnrollment}</StatusBadge>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </section>

        <section>
          <SectionHeading title={copy.recentProgress} as="h2" />
          <div className="mt-4">
            {stats.recentProgress.length === 0 ? (
              <EmptyState compact icon={<IconInbox className="h-6 w-6" />} title={copy.noActivity} description={copy.noActivityDescription} />
            ) : (
              <Panel>
                <ul>
                  {stats.recentProgress.map((item) => (
                    <li key={item.key} className="flex items-center justify-between gap-4 border-b border-panel-line px-5 py-3.5 last:border-b-0">
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-warm-white">{item.lessonTitle}</span>
                        <span className="block truncate text-xs text-ash">{item.studentName} · {shortDate(item.updatedAt, auth.locale)}</span>
                      </span>
                      <StatusBadge tone={item.completed ? "success" : "muted"}>{item.completed ? copy.completed : copy.inProgress}</StatusBadge>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </section>
      </div>

      <section className="mt-12">
        <SectionHeading title={copy.shortcuts} as="h2" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((shortcut) => (
            <Link key={shortcut.title} href={shortcut.href} className="rounded-[3px] border border-panel-line bg-panel p-5 transition-colors duration-200 hover:border-ash hover:bg-panel-hi">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-panel-line bg-panel-hi text-gold"><shortcut.icon className="h-4 w-4" /></span>
              <span className="display mt-3 block text-[0.9375rem] text-warm-white">{shortcut.title}</span>
              <span className="mt-1.5 block text-xs leading-relaxed text-ash">{shortcut.text}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
