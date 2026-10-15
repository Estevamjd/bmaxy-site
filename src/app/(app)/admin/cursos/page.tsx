import Link from "next/link";
import type { Metadata } from "next";
import { adminContent, formatAdminMessage } from "@/content/admin";
import { requireAdmin } from "@/lib/auth/session";
import { IconBooks } from "@/components/platform/icons";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatusBadge,
  type DataTableColumn,
} from "@/components/platform/ui";
import { listCoursesForAdmin, type AdminCourseSummary } from "@/lib/dal/admin";
import { CreateCourseForm } from "./CourseForms";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireAdmin("/admin/cursos");
  return { title: adminContent[auth.locale].meta.courses };
}

export default async function AdminCoursesPage() {
  const auth = await requireAdmin("/admin/cursos");
  const copy = adminContent[auth.locale];
  const text = copy.courses.list;
  const courses = await listCoursesForAdmin();
  const titleFor = (course: AdminCourseSummary) =>
    auth.locale === "en" ? course.titleEn : course.titlePt;

  const columns: DataTableColumn<AdminCourseSummary>[] = [
    {
      key: "title",
      header: text.course,
      cell: (c) => (
        <Link
          href={`/admin/cursos/${c.id}`}
          className="block min-w-0 transition-colors duration-200 hover:text-gold"
        >
          <span className="block truncate">{titleFor(c)}</span>
          <span className="block truncate text-xs text-ash">/{c.slug}</span>
        </Link>
      ),
    },
    {
      key: "students",
      header: text.activeStudents,
      cell: (c) => <span className="text-ash">{c.studentCount}</span>,
    },
    {
      key: "status",
      header: text.status,
      align: "right",
      cell: (c) => (
        <StatusBadge tone={c.status === "published" ? "success" : "muted"}>
          {c.status === "published" ? copy.common.published : copy.common.draft}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={copy.common.management}
        title={text.title}
        description={text.description}
      />

      <div className="mt-8">
        <CreateCourseForm content={copy} />
      </div>

      <div className="mt-6">
        <DataTable
          caption={text.caption}
          columns={columns}
          rows={courses}
          rowKey={(c) => c.id}
          mobileCard={(c) => (
            <Link href={`/admin/cursos/${c.id}`} className="block">
              <Panel className="p-4 transition-colors duration-200 hover:border-ash hover:bg-panel-hi">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-warm-white">{titleFor(c)}</p>
                    <p className="truncate text-xs text-ash">/{c.slug}</p>
                  </div>
                  <StatusBadge tone={c.status === "published" ? "success" : "muted"}>
                    {c.status === "published" ? copy.common.published : copy.common.draft}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-xs text-ash">
                  {c.studentCount === 1
                    ? text.accessOne
                    : formatAdminMessage(text.accessMany, { count: c.studentCount })}
                </p>
              </Panel>
            </Link>
          )}
          empty={
            <EmptyState
              icon={<IconBooks className="h-6 w-6" />}
              title={text.empty}
              description={text.emptyDescription}
            />
          }
        />
      </div>
    </div>
  );
}
