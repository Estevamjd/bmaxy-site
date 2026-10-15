import Link from "next/link";
import type { Metadata } from "next";
import { adminContent, formatAdminMessage, type AdminContent } from "@/content/admin";
import type { PlatformLocale } from "@/content/platform";
import { requireAdmin } from "@/lib/auth/session";
import { IconSearch, IconUsers } from "@/components/platform/icons";
import {
  ButtonLink,
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatusBadge,
  buttonStyles,
  type DataTableColumn,
} from "@/components/platform/ui";
import { listStudents, type AdminStudentSummary, type StudentFilter } from "@/lib/dal/admin";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireAdmin("/admin/alunos");
  return { title: adminContent[auth.locale].meta.students };
}

function formatDate(iso: string, locale: PlatformLocale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function activeCourses(student: AdminStudentSummary): string[] {
  return student.enrollments.filter((e) => e.status === "active").map((e) => e.courseTitle);
}

function StudentStatus({ student, copy }: { student: AdminStudentSummary; copy: AdminContent["students"]["list"] }) {
  const active = activeCourses(student).length;
  if (!student.emailConfirmedAt) return <StatusBadge tone="warning">{copy.emailPending}</StatusBadge>;
  if (student.mustChangePassword) return <StatusBadge tone="pending">{copy.temporaryPassword}</StatusBadge>;
  if (active > 0) return <StatusBadge tone="success">{copy.hasAccess}</StatusBadge>;
  return <StatusBadge tone="muted">{copy.noEnrollment}</StatusBadge>;
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; matricula?: string }>;
}) {
  const auth = await requireAdmin("/admin/alunos");
  const copy = adminContent[auth.locale];
  const text = copy.students.list;
  const filters: { value: NonNullable<StudentFilter["enrollment"]>; label: string }[] = [
    { value: "all", label: text.filters.all },
    { value: "active", label: text.filters.active },
    { value: "revoked", label: text.filters.revoked },
    { value: "none", label: text.filters.none },
  ];
  const { q, matricula } = await searchParams;
  const enrollment = (filters.find((f) => f.value === matricula)?.value ?? "all") as NonNullable<StudentFilter["enrollment"]>;
  const search = (q ?? "").trim();
  const students = await listStudents({ search, enrollment }, auth.locale);
  const isFiltering = search.length > 0 || enrollment !== "all";
  const description = isFiltering
    ? students.length === 1 ? text.resultOne : formatAdminMessage(text.resultMany, { count: students.length })
    : students.length === 1 ? text.countOne : formatAdminMessage(text.countMany, { count: students.length });

  const columns: DataTableColumn<AdminStudentSummary>[] = [
    {
      key: "name",
      header: text.columns.student,
      cell: (student) => (
        <Link href={`/admin/alunos/${student.id}`} className="block min-w-0 transition-colors duration-200 hover:text-gold">
          <span className="block truncate">{student.fullName || copy.common.notNamed}</span>
          <span className="block truncate text-xs text-ash">{student.email}</span>
        </Link>
      ),
    },
    {
      key: "courses",
      header: text.columns.activeCourses,
      hideBelowLg: true,
      cell: (student) => {
        const courses = activeCourses(student);
        return courses.length === 0 ? <span className="text-ash">—</span> : <span className="truncate">{courses.join(", ")}</span>;
      },
    },
    { key: "created", header: text.columns.created, cell: (student) => <span className="text-ash">{formatDate(student.createdAt, auth.locale)}</span> },
    { key: "status", header: text.columns.status, align: "right", cell: (student) => <StudentStatus student={student} copy={text} /> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={copy.common.management}
        title={text.title}
        description={description}
        actions={<ButtonLink href="/admin/alunos/novo" tone="primary">{text.create}</ButtonLink>}
      />

      <form method="get" className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="student-search" className="label-eyebrow block text-ash">{text.search}</label>
          <div className="relative mt-1.5">
            <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ash"><IconSearch className="h-4 w-4" /></span>
            <input id="student-search" type="search" name="q" defaultValue={search} placeholder={text.searchPlaceholder} className="w-full rounded-[3px] border border-panel-line bg-void py-2.5 pl-10 pr-3.5 font-sans text-sm text-warm-white placeholder:text-ash/60 transition-colors duration-200 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40" />
          </div>
        </div>
        <div className="sm:w-56">
          <label htmlFor="enrollment-filter" className="label-eyebrow block text-ash">{text.enrollment}</label>
          <select id="enrollment-filter" name="matricula" defaultValue={enrollment} className="mt-1.5 w-full rounded-[3px] border border-panel-line bg-void px-3.5 py-2.5 font-sans text-sm text-warm-white transition-colors duration-200 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40">
            {filters.map((filter) => <option key={filter.value} value={filter.value} className="bg-void">{filter.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonStyles.secondary}>{text.filter}</button>
          {isFiltering ? <Link href="/admin/alunos" className={buttonStyles.ghost}>{text.clear}</Link> : null}
        </div>
      </form>

      <div className="mt-6">
        <DataTable
          caption={text.caption}
          columns={columns}
          rows={students}
          rowKey={(student) => student.id}
          mobileCard={(student) => (
            <Link href={`/admin/alunos/${student.id}`} className="block">
              <Panel className="p-4 transition-colors duration-200 hover:border-ash hover:bg-panel-hi">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm text-warm-white">{student.fullName || copy.common.notNamed}</p><p className="truncate text-xs text-ash">{student.email}</p></div>
                  <StudentStatus student={student} copy={text} />
                </div>
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-ash">{text.columns.activeCourses}</dt><dd className="min-w-0 truncate text-right text-warm-white">{activeCourses(student).join(", ") || "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ash">{text.columns.created}</dt><dd className="text-warm-white">{formatDate(student.createdAt, auth.locale)}</dd></div>
                </dl>
              </Panel>
            </Link>
          )}
          empty={isFiltering ? (
            <EmptyState icon={<IconSearch className="h-6 w-6" />} title={text.noFiltered} description={text.noFilteredDescription} action={<Link href="/admin/alunos" className={buttonStyles.secondary}>{text.clearFilter}</Link>} />
          ) : (
            <EmptyState icon={<IconUsers className="h-6 w-6" />} title={text.empty} description={text.emptyDescription} action={<ButtonLink href="/admin/alunos/novo" tone="primary">{text.createFirst}</ButtonLink>} />
          )}
        />
      </div>
    </div>
  );
}
