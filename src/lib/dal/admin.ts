import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PlatformLocale } from "@/content/platform";

/**
 * CADA função exportada abaixo valida a própria autorização antes de tocar
 * em qualquer dado — não depende de o layout já ter rodado requireAdmin().
 *
 * Motivo: layout e página podem buscar dados em paralelo (e generateMetadata
 * roda antes/junto da página, não depois do layout), então "o layout pai já
 * checou" não é garantia nenhuma de ordem de execução. E algumas funções
 * aqui usam createAdminClient() (service role), que ignora RLS por
 * completo — se a checagem de admin não rodasse ANTES de criar esse
 * cliente, RLS não estaria ali pra segurar nada.
 *
 * requireAdmin() já faz os três passos exigidos, nesta ordem: valida sessão
 * via supabase.auth.getUser() (revalida no servidor do Supabase, não só lê
 * cookie) -> consulta a role real em user_roles -> redireciona se não for
 * 'admin'. Só depois disso qualquer função aqui cria ou usa
 * createAdminClient().
 *
 * Usa o cliente admin (service role) só para supabase.auth.admin.* — que é
 * a única forma de ler e-mail e criar conta, já que auth.users não é uma
 * tabela pública. Pra tabelas de negócio (profiles, user_roles, courses,
 * enrollments, lesson_progress), usa o cliente autenticado normal: a
 * sessão do admin já passa pelas policies "*_admin_all" via is_admin(), o
 * que é mais auditável do que contornar RLS sem necessidade.
 */

export type AdminEnrollmentSummary = {
  enrollmentId: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  status: "active" | "revoked";
};

export type AdminStudentSummary = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  /** null enquanto a pessoa não confirmou o e-mail do cadastro público. */
  emailConfirmedAt: string | null;
  mustChangePassword: boolean;
  enrollments: AdminEnrollmentSummary[];
};

async function loadStudentRoleAndBusinessData() {
  const supabase = await createClient();
  const [{ data: roleRows }, { data: profileRows }, { data: enrollmentRows }, { data: courseRows }] =
    await Promise.all([
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("profiles").select("id, full_name, must_change_password"),
      supabase.from("enrollments").select("id, user_id, course_id, status"),
      supabase.from("courses").select("id, slug, title_pt, title_en"),
    ]);

  return {
    roleByUser: new Map((roleRows ?? []).map((r) => [r.user_id, r.role])),
    profileByUser: new Map((profileRows ?? []).map((p) => [p.id, p])),
    enrollmentRows: enrollmentRows ?? [],
    courseById: new Map((courseRows ?? []).map((c) => [c.id, c])),
  };
}

export type StudentFilter = {
  /** Nome ou e-mail, sem diferenciar maiúsculas nem acentos. */
  search?: string;
  /** "active" = tem ao menos uma matrícula ativa. "none" = nenhuma. */
  enrollment?: "all" | "active" | "revoked" | "none";
};

/** Sem acento e em minúsculas — "João" tem que ser achado digitando "joao". */
function normalize(value: string): string {
  // ̀-ͯ é o bloco de acentos combinantes que o NFD separa das letras.
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export async function listStudents(
  filter: StudentFilter = {},
  locale: PlatformLocale = "pt",
): Promise<AdminStudentSummary[]> {
  await requireAdmin("/admin/alunos");

  const admin = createAdminClient();
  const { data: usersPage, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;

  const { roleByUser, profileByUser, enrollmentRows, courseById } =
    await loadStudentRoleAndBusinessData();

  const enrollmentsByUser = new Map<string, AdminEnrollmentSummary[]>();
  for (const e of enrollmentRows) {
    const course = courseById.get(e.course_id);
    if (!course) continue;
    const list = enrollmentsByUser.get(e.user_id) ?? [];
    list.push({
      enrollmentId: e.id,
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: locale === "en" ? course.title_en : course.title_pt,
      status: e.status,
    });
    enrollmentsByUser.set(e.user_id, list);
  }

  const students = usersPage.users
    .filter((u) => roleByUser.get(u.id) === "student")
    .map((u) => {
      const profile = profileByUser.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        fullName: profile?.full_name ?? "",
        createdAt: u.created_at,
        emailConfirmedAt: u.email_confirmed_at ?? null,
        mustChangePassword: profile?.must_change_password ?? false,
        enrollments: enrollmentsByUser.get(u.id) ?? [],
      };
    });

  /* Filtra na aplicação de propósito: a lista de contas vem da API de Auth
     (auth.users não é tabela consultável), então não há WHERE para delegar ao
     Postgres. Com `perPage: 200` isso é uma varredura de 200 itens em memória.
     Se um dia passar disso, o caminho é paginar a API de Auth — não montar um
     índice aqui. */
  const term = filter.search ? normalize(filter.search) : "";
  const filtered = students.filter((s) => {
    if (term && !normalize(`${s.fullName} ${s.email}`).includes(term)) return false;

    const active = s.enrollments.filter((e) => e.status === "active").length;
    const revoked = s.enrollments.filter((e) => e.status === "revoked").length;

    switch (filter.enrollment) {
      case "active":
        return active > 0;
      case "revoked":
        return revoked > 0;
      case "none":
        return s.enrollments.length === 0;
      default:
        return true;
    }
  });

  return filtered.sort((a, b) =>
    (a.fullName || a.email).localeCompare(b.fullName || b.email, locale === "en" ? "en-US" : "pt-BR"),
  );
}

export async function getStudentById(
  userId: string,
  locale: PlatformLocale = "pt",
): Promise<AdminStudentSummary | null> {
  await requireAdmin("/admin/alunos");

  const admin = createAdminClient();
  const { data: userRow, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userRow.user) return null;

  const { roleByUser, profileByUser, enrollmentRows, courseById } =
    await loadStudentRoleAndBusinessData();

  if (roleByUser.get(userId) !== "student") return null;

  const enrollments: AdminEnrollmentSummary[] = enrollmentRows
    .filter((e) => e.user_id === userId)
    .map((e) => {
      const course = courseById.get(e.course_id);
      return {
        enrollmentId: e.id,
        courseId: e.course_id,
        courseSlug: course?.slug ?? "",
        courseTitle: course ? (locale === "en" ? course.title_en : course.title_pt) : "",
        status: e.status,
      };
    })
    .filter((e) => e.courseSlug);

  const profile = profileByUser.get(userId);

  return {
    id: userId,
    email: userRow.user.email ?? "",
    fullName: profile?.full_name ?? "",
    createdAt: userRow.user.created_at,
    emailConfirmedAt: userRow.user.email_confirmed_at ?? null,
    mustChangePassword: profile?.must_change_password ?? false,
    enrollments,
  };
}

export type AdminCourseSummary = {
  id: string;
  slug: string;
  titlePt: string;
  titleEn: string;
  status: "draft" | "published";
  studentCount: number;
};

export async function listCoursesForAdmin(): Promise<AdminCourseSummary[]> {
  await requireAdmin("/admin/cursos");

  const supabase = await createClient();
  const [{ data: courseRows }, { data: enrollmentRows }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, slug, title_pt, title_en, status")
      .order("created_at", { ascending: true }),
    supabase.from("enrollments").select("course_id, status"),
  ]);

  const activeCountByCourse = new Map<string, number>();
  for (const e of enrollmentRows ?? []) {
    if (e.status !== "active") continue;
    activeCountByCourse.set(e.course_id, (activeCountByCourse.get(e.course_id) ?? 0) + 1);
  }

  return (courseRows ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    titlePt: c.title_pt,
    titleEn: c.title_en,
    status: c.status,
    studentCount: activeCountByCourse.get(c.id) ?? 0,
  }));
}

export type AdminLessonDetail = {
  id: string;
  titlePt: string;
  titleEn: string;
  orderIndex: number;
  status: "draft" | "coming_soon" | "published";
  /**
   * Só "tem vídeo cadastrado?". O ID em si vive em public.lesson_media, que
   * nem a sessão do administrador lê pela API (a tabela tem RLS ligada e
   * nenhuma policy — ver migration 20260803202703_private_lesson_media.sql).
   * Para cadastrar ou trocar um vídeo é preciso passar por uma Server Action
   * que use createAdminClient(), a única credencial que ignora RLS. O painel
   * de hoje só EXIBE o estado, então este booleano basta.
   */
  hasVideo: boolean;
  descriptionPt: string;
  descriptionEn: string;
  durationSeconds: number | null;
};

export type AdminModuleDetail = {
  id: string;
  titlePt: string;
  titleEn: string;
  orderIndex: number;
  lessons: AdminLessonDetail[];
};

export type AdminCourseDetail = {
  id: string;
  slug: string;
  titlePt: string;
  titleEn: string;
  descriptionPt: string;
  descriptionEn: string;
  status: "draft" | "published";
  /** Matrículas ativas — quem perde acesso se este curso voltar a rascunho. */
  activeStudentCount: number;
  modules: AdminModuleDetail[];
};

export async function getCourseDetailForAdmin(courseId: string): Promise<AdminCourseDetail | null> {
  await requireAdmin("/admin/cursos");

  const supabase = await createClient();

  const { data: courseRow } = await supabase
    .from("courses")
    .select("id, slug, title_pt, title_en, description_pt, description_en, status")
    .eq("id", courseId)
    .maybeSingle();
  if (!courseRow) return null;

  const { data: moduleRows } = await supabase
    .from("course_modules")
    .select("id, title_pt, title_en, order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  const moduleIds = (moduleRows ?? []).map((m) => m.id);
  const [{ data: lessonRows }, { count: activeStudentCount }] = await Promise.all([
    moduleIds.length
      ? supabase
          .from("lessons")
          .select(
            "id, module_id, title_pt, title_en, description_pt, description_en, order_index, status, has_video, duration_seconds",
          )
          .in("module_id", moduleIds)
          .order("order_index", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("status", "active"),
  ]);

  const lessonsByModule = new Map<string, AdminLessonDetail[]>();
  for (const l of lessonRows ?? []) {
    const list = lessonsByModule.get(l.module_id) ?? [];
    list.push({
      id: l.id,
      titlePt: l.title_pt,
      titleEn: l.title_en,
      descriptionPt: l.description_pt,
      descriptionEn: l.description_en,
      orderIndex: l.order_index,
      status: l.status,
      hasVideo: l.has_video,
      durationSeconds: l.duration_seconds,
    });
    lessonsByModule.set(l.module_id, list);
  }

  return {
    id: courseRow.id,
    slug: courseRow.slug,
    titlePt: courseRow.title_pt,
    titleEn: courseRow.title_en,
    descriptionPt: courseRow.description_pt,
    descriptionEn: courseRow.description_en,
    status: courseRow.status,
    activeStudentCount: activeStudentCount ?? 0,
    modules: (moduleRows ?? []).map((m) => ({
      id: m.id,
      titlePt: m.title_pt,
      titleEn: m.title_en,
      orderIndex: m.order_index,
      lessons: lessonsByModule.get(m.id) ?? [],
    })),
  };
}

export type AdminRecentStudent = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  emailConfirmedAt: string | null;
  activeEnrollments: number;
};

export type AdminRecentProgress = {
  key: string;
  studentName: string;
  lessonTitle: string;
  completed: boolean;
  updatedAt: string;
};

export type AdminDashboardStats = {
  studentCount: number;
  activeEnrollments: number;
  courseCount: number;
  publishedCourses: number;
  publishedLessons: number;
  comingSoonLessons: number;
  /** Publicadas SEM vídeo — o número que pede ação: o aluno vê a aula vazia. */
  lessonsWithoutVideo: number;
  recentStudents: AdminRecentStudent[];
  recentProgress: AdminRecentProgress[];
};

/**
 * Todos os números aqui são consultas reais. Nenhum é estimado, projetado ou
 * comparado com período anterior — não existe histórico no banco para isso, e
 * um painel que inventa tendência é pior do que um painel sem gráfico.
 */
export async function getAdminDashboardStats(
  locale: PlatformLocale = "pt",
): Promise<AdminDashboardStats> {
  await requireAdmin("/admin");

  const admin = createAdminClient();
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });

  const { roleByUser, profileByUser, enrollmentRows } = await loadStudentRoleAndBusinessData();

  const studentUsers = (usersPage?.users ?? []).filter(
    (u) => roleByUser.get(u.id) === "student",
  );

  const activeByUser = new Map<string, number>();
  for (const e of enrollmentRows) {
    if (e.status !== "active") continue;
    activeByUser.set(e.user_id, (activeByUser.get(e.user_id) ?? 0) + 1);
  }

  const recentStudents: AdminRecentStudent[] = [...studentUsers]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5)
    .map((u) => ({
      id: u.id,
      fullName: profileByUser.get(u.id)?.full_name ?? "",
      email: u.email ?? "",
      createdAt: u.created_at,
      emailConfirmedAt: u.email_confirmed_at ?? null,
      activeEnrollments: activeByUser.get(u.id) ?? 0,
    }));

  const supabase = await createClient();
  const [
    { count: activeEnrollments },
    { count: courseCount },
    { count: publishedCourses },
    { count: publishedLessons },
    { count: comingSoonLessons },
    { count: lessonsWithoutVideo },
    { data: progressRows },
  ] = await Promise.all([
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("status", "coming_soon"),
    supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .eq("has_video", false),
    supabase
      .from("lesson_progress")
      .select("user_id, lesson_id, completed, updated_at")
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  /* O progresso recente só vale se disser QUEM fez O QUÊ. "Aula concluída ·
     03/08" não ajuda ninguém, então os títulos e nomes são resolvidos aqui. */
  const lessonIds = [...new Set((progressRows ?? []).map((p) => p.lesson_id))];
  const { data: lessonTitleRows } = lessonIds.length
    ? await supabase.from("lessons").select("id, title_pt, title_en").in("id", lessonIds)
    : { data: [] as never[] };
  const lessonTitleById = new Map(
    (lessonTitleRows ?? []).map((l) => [l.id, locale === "en" ? l.title_en : l.title_pt]),
  );

  const recentProgress: AdminRecentProgress[] = (progressRows ?? []).map((p) => ({
    key: `${p.user_id}-${p.lesson_id}`,
    studentName: profileByUser.get(p.user_id)?.full_name || (locale === "en" ? "Student" : "Aluno"),
    lessonTitle: lessonTitleById.get(p.lesson_id) ?? (locale === "en" ? "Lesson" : "Aula"),
    completed: p.completed,
    updatedAt: p.updated_at,
  }));

  return {
    studentCount: studentUsers.length,
    activeEnrollments: activeEnrollments ?? 0,
    courseCount: courseCount ?? 0,
    publishedCourses: publishedCourses ?? 0,
    publishedLessons: publishedLessons ?? 0,
    comingSoonLessons: comingSoonLessons ?? 0,
    lessonsWithoutVideo: lessonsWithoutVideo ?? 0,
    recentStudents,
    recentProgress,
  };
}
