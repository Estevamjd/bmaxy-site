import "server-only";
import { requireStudent } from "@/lib/auth/session";
import { canRequestPlayback } from "@/lib/dal/lesson-playback";
import { createClient } from "@/lib/supabase/server";
import type { LessonStatus } from "@/lib/supabase/types";

/**
 * Toda leitura aqui roda com o cliente autenticado do aluno (server.ts),
 * não o admin — é a Row Level Security da migration inicial que decide o
 * que ele pode ver, não este arquivo. Isso significa: se a query voltar
 * vazia, é porque RLS bloqueou (curso não publicado, matrícula revogada,
 * aula draft etc.), não porque esquecemos um filtro aqui.
 *
 * E é JUSTAMENTE por depender da RLS que CADA função abaixo começa com
 * requireStudent(): para um administrador a RLS não filtra nada (as policies
 * são `is_admin() OR ...`), então uma sessão de admin passando por aqui
 * enxergaria o catálogo inteiro — inclusive curso em rascunho — com a cara da
 * área do aluno. A guarda no layout não basta sozinha: `generateMetadata` das
 * páginas de curso e de aula roda de forma independente do layout, e chama
 * estas funções direto.
 */

export type StudentCourse = {
  id: string;
  slug: string;
  titlePt: string;
  titleEn: string;
  descriptionPt: string;
  descriptionEn: string;
  coverUrl: string | null;
};

export type StudentLesson = {
  id: string;
  moduleId: string;
  titlePt: string;
  titleEn: string;
  descriptionPt: string;
  descriptionEn: string;
  orderIndex: number;
  status: LessonStatus;
  /**
   * NÃO existe videoId aqui, de propósito. O ID do vídeo saiu de
   * public.lessons e vive em public.lesson_media, que RLS não deixa ninguém
   * ler pela API (migration 20260803202703_private_lesson_media.sql). Este
   * booleano é só "tem vídeo cadastrado?", o suficiente para a interface
   * escolher entre o player e o aviso de "em breve".
   *
   * Para reproduzir, chame getLessonPlayback() — que passa pela função
   * segura do banco e valida matrícula, status e sequência.
   */
  hasVideo: boolean;
  durationSeconds: number | null;
};

export type StudentModule = {
  id: string;
  titlePt: string;
  titleEn: string;
  orderIndex: number;
  lessons: StudentLesson[];
};

export type StudentProgress = {
  lessonId: string;
  completed: boolean;
  percentComplete: number;
  lastPositionSeconds: number;
};

/** Cursos em que o aluno logado tem acesso de verdade (RLS já filtra). */
export async function listMyCourses(): Promise<StudentCourse[]> {
  await requireStudent("/aluno");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title_pt, title_en, description_pt, description_en, cover_url")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    titlePt: c.title_pt,
    titleEn: c.title_en,
    descriptionPt: c.description_pt,
    descriptionEn: c.description_en,
    coverUrl: c.cover_url,
  }));
}

/** Curso + módulos + aulas + progresso do aluno logado, ou null se não acessível. */
export async function getMyCourseBySlug(slug: string): Promise<{
  course: StudentCourse;
  modules: StudentModule[];
  progress: StudentProgress[];
} | null> {
  const auth = await requireStudent(`/aluno/curso/${slug}`);

  const supabase = await createClient();

  const { data: courseRow } = await supabase
    .from("courses")
    .select("id, slug, title_pt, title_en, description_pt, description_en, cover_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!courseRow) return null;

  const { data: moduleRows } = await supabase
    .from("course_modules")
    .select("id, title_pt, title_en, order_index")
    .eq("course_id", courseRow.id)
    .order("order_index", { ascending: true });

  const moduleIds = (moduleRows ?? []).map((m) => m.id);

  const { data: lessonRows } = moduleIds.length
    ? await supabase
        .from("lessons")
        .select(
          "id, module_id, title_pt, title_en, description_pt, description_en, order_index, status, has_video, duration_seconds",
        )
        .in("module_id", moduleIds)
        .order("order_index", { ascending: true })
    : { data: [] as never[] };

  const lessonIds = (lessonRows ?? []).map((l) => l.id);

  /* `.eq("user_id", ...)` explícito, e não só a RLS.
   *
   * A policy lesson_progress_select_authorized é
   * `user_id = auth.uid() OR is_admin()` — ou seja, para uma sessão de admin
   * ela devolve o progresso de TODOS os alunos. Como este select nem trazia
   * `user_id`, as linhas de terceiros ficavam indistinguíveis das próprias e
   * seriam contadas como progresso de quem está na tela. requireStudent()
   * acima já impede um admin de chegar aqui; o filtro é a segunda barreira,
   * e custa uma linha. */
  const { data: progressRows } = lessonIds.length
    ? await supabase
        .from("lesson_progress")
        .select("lesson_id, completed, percent_complete, last_position_seconds")
        .eq("user_id", auth.userId)
        .in("lesson_id", lessonIds)
    : { data: [] as never[] };

  const lessonsByModule = new Map<string, StudentLesson[]>();
  for (const l of lessonRows ?? []) {
    const lesson: StudentLesson = {
      id: l.id,
      moduleId: l.module_id,
      titlePt: l.title_pt,
      titleEn: l.title_en,
      descriptionPt: l.description_pt,
      descriptionEn: l.description_en,
      orderIndex: l.order_index,
      status: l.status,
      hasVideo: l.has_video,
      durationSeconds: l.duration_seconds,
    };
    const list = lessonsByModule.get(l.module_id) ?? [];
    list.push(lesson);
    lessonsByModule.set(l.module_id, list);
  }

  const modules: StudentModule[] = (moduleRows ?? []).map((m) => ({
    id: m.id,
    titlePt: m.title_pt,
    titleEn: m.title_en,
    orderIndex: m.order_index,
    lessons: lessonsByModule.get(m.id) ?? [],
  }));

  return {
    course: {
      id: courseRow.id,
      slug: courseRow.slug,
      titlePt: courseRow.title_pt,
      titleEn: courseRow.title_en,
      descriptionPt: courseRow.description_pt,
      descriptionEn: courseRow.description_en,
      coverUrl: courseRow.cover_url,
    },
    modules,
    progress: (progressRows ?? []).map((p) => ({
      lessonId: p.lesson_id,
      completed: p.completed,
      percentComplete: p.percent_complete,
      lastPositionSeconds: p.last_position_seconds,
    })),
  };
}

/**
 * Uma aula específica + o curso/módulo dela + a lista completa de aulas do
 * módulo (pra montar a navegação anterior/próxima) + o progresso do aluno.
 * Retorna null se a aula não existe OU se RLS bloqueou (aula draft, sem
 * matrícula etc.) — os dois casos viram "não encontrada" pra quem chama.
 */
/**
 * Aula + curso inteiro (TODAS as aulas de TODOS os módulos, na ordem certa
 * — módulo antes de aula, já que order_index de aula é único só dentro do
 * módulo, não do curso inteiro) + progresso do aluno em TODAS elas.
 *
 * Precisa ser o curso inteiro, não só o módulo da aula atual: o bloqueio
 * sequencial (computeLessonUnlockMap) depende de saber se CADA aula
 * publicada anterior foi concluída, e "anterior" atravessa módulo — um
 * curso com módulo A (aula 1) e módulo B (aula 2) só calcula certo se
 * enxergar as duas aulas e os dois progressos ao mesmo tempo. A versão
 * antiga buscava só as aulas do mesmo módulo e só o progresso da aula
 * atual — quebrava o bloqueio em qualquer curso com mais de um módulo, e
 * fazia toda aula parecer "primeira aula" (previousPublishedCompleted
 * sempre nascia true porque as aulas anteriores nem entravam na conta).
 */
export async function getMyLessonById(lessonId: string): Promise<{
  course: StudentCourse;
  lesson: StudentLesson;
  courseLessons: StudentLesson[];
  allProgress: StudentProgress[];
} | null> {
  const auth = await requireStudent(`/aluno/aula/${lessonId}`);

  const supabase = await createClient();

  const { data: lessonRow } = await supabase
    .from("lessons")
    .select(
      "id, module_id, title_pt, title_en, description_pt, description_en, order_index, status, has_video, duration_seconds",
    )
    .eq("id", lessonId)
    .maybeSingle();

  if (!lessonRow) return null;

  const { data: moduleRow } = await supabase
    .from("course_modules")
    .select("id, course_id")
    .eq("id", lessonRow.module_id)
    .maybeSingle();

  if (!moduleRow) return null;

  const { data: courseRow } = await supabase
    .from("courses")
    .select("id, slug, title_pt, title_en, description_pt, description_en, cover_url")
    .eq("id", moduleRow.course_id)
    .maybeSingle();

  if (!courseRow) return null;

  const { data: allModuleRows } = await supabase
    .from("course_modules")
    .select("id, order_index")
    .eq("course_id", courseRow.id)
    .order("order_index", { ascending: true });

  const moduleIds = (allModuleRows ?? []).map((m) => m.id);

  const { data: allLessonRows } = moduleIds.length
    ? await supabase
        .from("lessons")
        .select(
          "id, module_id, title_pt, title_en, description_pt, description_en, order_index, status, has_video, duration_seconds",
        )
        .in("module_id", moduleIds)
    : { data: [] as never[] };

  const moduleOrderById = new Map((allModuleRows ?? []).map((m) => [m.id, m.order_index]));
  const orderedLessonRows = [...(allLessonRows ?? [])].sort((a, b) => {
    const moduleDiff = (moduleOrderById.get(a.module_id) ?? 0) - (moduleOrderById.get(b.module_id) ?? 0);
    if (moduleDiff !== 0) return moduleDiff;
    return a.order_index - b.order_index;
  });

  // Mesmo motivo do filtro em getMyCourseBySlug: a RLS não separa por usuário
  // quando quem consulta é admin.
  const lessonIds = orderedLessonRows.map((l) => l.id);
  const { data: progressRows } = lessonIds.length
    ? await supabase
        .from("lesson_progress")
        .select("lesson_id, completed, percent_complete, last_position_seconds")
        .eq("user_id", auth.userId)
        .in("lesson_id", lessonIds)
    : { data: [] as never[] };

  const mapLesson = (l: (typeof orderedLessonRows)[number]): StudentLesson => ({
    id: l.id,
    moduleId: l.module_id,
    titlePt: l.title_pt,
    titleEn: l.title_en,
    descriptionPt: l.description_pt,
    descriptionEn: l.description_en,
    orderIndex: l.order_index,
    status: l.status,
    hasVideo: l.has_video,
    durationSeconds: l.duration_seconds,
  });

  return {
    course: {
      id: courseRow.id,
      slug: courseRow.slug,
      titlePt: courseRow.title_pt,
      titleEn: courseRow.title_en,
      descriptionPt: courseRow.description_pt,
      descriptionEn: courseRow.description_en,
      coverUrl: courseRow.cover_url,
    },
    lesson: mapLesson(lessonRow),
    courseLessons: orderedLessonRows.map(mapLesson),
    allProgress: (progressRows ?? []).map((p) => ({
      lessonId: p.lesson_id,
      completed: p.completed,
      percentComplete: p.percent_complete,
      lastPositionSeconds: p.last_position_seconds,
    })),
  };
}

export type LessonPlayback = { provider: "youtube"; videoId: string };

/**
 * O dado de reprodução de UMA aula. É a única forma de o servidor obter um
 * video_id — não existe mais coluna para consultar.
 *
 * DUAS BARREIRAS, de propósito:
 *
 *  1. `canRequestPlayback` aqui em cima, sobre os dados que a página já
 *     carregou. Evita a ida ao banco quando a resposta já é conhecida e
 *     mantém a interface coerente com o que o banco responderia.
 *  2. `get_lesson_playback()` no Postgres, que é a autoridade: security
 *     definer, deriva o usuário de auth.uid() e revalida autenticação,
 *     matrícula ativa, curso e aula publicados e a conclusão de todas as
 *     aulas publicadas anteriores. Mesmo que esta função aqui tivesse um bug,
 *     ou que alguém chamasse a API do Supabase direto, o banco barra.
 *
 * Devolve null em qualquer negativa — inclusive quando o banco levanta
 * exceção. Quem chama não precisa distinguir "bloqueada" de "sem vídeo" para
 * decidir o que renderizar; a página já sabe disso pelo status e pelo mapa de
 * desbloqueio, e repassar o motivo do banco só serviria para dar pistas a
 * quem está tentando burlar.
 */
export async function getLessonPlayback(
  lesson: StudentLesson,
  unlocked: boolean,
): Promise<LessonPlayback | null> {
  await requireStudent(`/aluno/aula/${lesson.id}`);

  const gate = canRequestPlayback(
    { id: lesson.id, status: lesson.status, hasVideo: lesson.hasVideo },
    unlocked,
  );
  if (!gate.allowed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_lesson_playback", {
    p_lesson_id: lesson.id,
  });

  if (error) return null;

  // `returns table(...)` no Postgres vira lista aqui — vazia quando a aula
  // não tem mídia cadastrada.
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.video_id) return null;

  return { provider: row.video_provider, videoId: row.video_id };
}

// computeLessonUnlockMap mora em ./lesson-unlock.ts — módulo puro, sem
// "server-only" nem Supabase, pra poder ser testado sem subir a app. Fica
// reexportada aqui pra não quebrar quem já importa de "@/lib/dal/student".
export { computeLessonUnlockMap } from "./lesson-unlock";
