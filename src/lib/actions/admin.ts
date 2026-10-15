"use server";

import { revalidatePath } from "next/cache";
import { adminContent, formatAdminMessage, type AdminContent } from "@/content/admin";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { parseYouTubeVideoId } from "@/lib/youtube";
import { createAdminValidation } from "@/lib/validation/admin";

export type AdminActionState = { error?: string; success?: string } | undefined;

async function adminActionContext(nextPath: string) {
  const auth = await requireAdmin(nextPath);
  return {
    auth,
    copy: adminContent[auth.locale].actions,
    schemas: createAdminValidation(auth.locale),
  };
}

/**
 * Toda action aqui começa com requireAdmin() — não confia em role vinda do
 * cliente nem em nada escondido na interface. Se a sessão não for de um
 * admin de verdade (checado no servidor contra user_roles), a chamada
 * redireciona antes de tocar em qualquer dado.
 */

export async function createStudentAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/alunos/novo");

  const parsed = schemas.createStudentSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    temporaryPassword: formData.get("temporaryPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (error || !data.user) {
    // Nada foi criado, então NÃO há rollback a fazer aqui — e é essencial não
    // tentar. O motivo mais comum de cair neste ramo é "e-mail já existe", e
    // essa conta é de outra pessoa: apagá-la seria destruir um cadastro alheio
    // por causa de um formulário digitado duas vezes.
    //
    // Mensagem genérica de propósito — não ecoa o erro bruto do provedor
    // (pode conter detalhes internos), e cobre o caso comum de e-mail já
    // cadastrado sem confirmar isso explicitamente pra quem não é dono da
    // conta.
    return { error: copy.createStudentFailed };
  }

  // Daqui pra baixo existe um usuário no Auth que ESTA execução acabou de
  // criar. Este id — e só ele — é o que o rollback tem permissão de apagar.
  const createdUserId = data.user.id;

  // O trigger on_auth_user_created já criou profiles + user_roles='student'
  // com full_name vazio; aqui só completamos o nome e marcamos a senha
  // como temporária (força troca no primeiro login).
  //
  // O `.select()` não é enfeite: um UPDATE que não encontra linha nenhuma
  // volta SEM erro. Sem ele, um perfil que o trigger não criou passaria por
  // "aluno criado" — e o aluno existiria só no Auth, exatamente o estado
  // pela metade que esta action precisa impedir.
  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.fullName, must_change_password: true })
    .eq("id", createdUserId)
    .select("id")
    .maybeSingle();

  if (profileError || !profileRow) {
    return rollbackCreatedStudent(admin, createdUserId, parsed.data.email, copy);
  }

  revalidatePath("/admin/alunos");
  return { success: copy.studentCreated };
}

/**
 * Desfaz a criação do usuário quando o cadastro não pôde ser concluído.
 *
 * Sem isto, uma falha depois do createUser deixava uma conta zumbi: usuário no
 * Auth, sem perfil, invisível para o painel — e o e-mail preso para sempre,
 * porque toda tentativa seguinte esbarrava em "e-mail já existe" sem que
 * ninguém conseguisse limpar o estado pela interface.
 *
 * Só é chamada com o id devolvido pelo createUser da MESMA execução. Uma conta
 * preexistente nunca chega aqui: quando o e-mail já existe, o createUser falha
 * e a action retorna antes, sem id nenhum em mãos.
 */
async function rollbackCreatedStudent(
  admin: ReturnType<typeof createAdminClient>,
  createdUserId: string,
  email: string,
  copy: AdminContent["actions"],
): Promise<AdminActionState> {
  let rolledBack = false;
  try {
    const { error } = await admin.auth.admin.deleteUser(createdUserId);
    rolledBack = !error;
  } catch {
    // Rede/timeout na exclusão conta como rollback falho — o usuário pode ter
    // ficado lá. Engolir isso é o que produz a conta zumbi silenciosa.
    rolledBack = false;
  }

  if (!rolledBack) {
    // O operador precisa saber que sobrou algo e sobre qual e-mail, senão a
    // conta incompleta fica invisível até o próximo cadastro falhar. Só o
    // e-mail: é o que se procura no painel do Supabase, e é um dado que quem
    // está na tela acabou de digitar.
    return {
      error: formatAdminMessage(copy.rollbackIncomplete, { email }),
    };
  }

  return {
    error: copy.rollbackDone,
  };
}

export async function updateStudentNameAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/alunos");

  const parsed = schemas.updateStudentNameSchema.safeParse({
    userId: formData.get("userId"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", parsed.data.userId);

  if (error) return { error: copy.updateNameFailed };

  revalidatePath(`/admin/alunos/${parsed.data.userId}`);
  revalidatePath("/admin/alunos");
  return { success: copy.nameUpdated };
}

export async function enrollStudentAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { auth: admin, copy, schemas } = await adminActionContext("/admin/alunos");

  const parsed = schemas.enrollmentActionSchema.safeParse({
    userId: formData.get("userId"),
    courseId: formData.get("courseId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").upsert(
    {
      user_id: parsed.data.userId,
      course_id: parsed.data.courseId,
      status: "active",
      source: "manual",
      granted_by: admin.userId,
    },
    { onConflict: "user_id,course_id" },
  );

  if (error) return { error: copy.grantCourseFailed };

  revalidatePath(`/admin/alunos/${parsed.data.userId}`);
  return { success: copy.courseGranted };
}

export async function revokeEnrollmentAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/alunos");

  const parsed = schemas.revokeEnrollmentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
  });
  if (!parsed.success) {
    return { error: copy.invalidEnrollment };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("enrollments")
    .update({ status: "revoked" })
    .eq("id", parsed.data.enrollmentId);

  if (error) return { error: copy.revokeFailed };

  const userIdRaw = formData.get("userId");
  if (typeof userIdRaw === "string") revalidatePath(`/admin/alunos/${userIdRaw}`);
  return { success: copy.accessRevoked };
}

export async function updateCourseStatusAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.courseStatusSchema.safeParse({
    courseId: formData.get("courseId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: copy.invalidData };

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.courseId);

  if (error) return { error: copy.updateCourseStatusFailed };

  revalidatePath(`/admin/cursos/${parsed.data.courseId}`);
  revalidatePath("/admin/cursos");
  return { success: copy.courseStatusUpdated };
}

export async function updateLessonStatusAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.lessonStatusSchema.safeParse({
    lessonId: formData.get("lessonId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: copy.invalidData };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.lessonId);

  if (error) return { error: copy.updateLessonStatusFailed };

  const courseId = formData.get("courseId");
  if (typeof courseId === "string") revalidatePath(`/admin/cursos/${courseId}`);
  return { success: copy.lessonStatusUpdated };
}

/* ==========================================================================
   CONTEÚDO — cursos, módulos, aulas e vídeo

   Tudo aqui usa o cliente AUTENTICADO como admin (server.ts), não o
   service_role: as policies "*_admin_all" já dão CRUD completo ao admin, e
   passar por elas mantém a regra auditável no banco em vez de contorná-la. A
   ÚNICA exceção é `lesson_media`, que não tem policy nenhuma de propósito —
   ali o service_role é obrigatório, e só depois de requireAdmin().
   ========================================================================== */

export async function createCourseAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.createCourseSchema.safeParse({
    slug: formData.get("slug"),
    titlePt: formData.get("titlePt"),
    titleEn: formData.get("titleEn"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();
  // Nasce como rascunho, sempre. Um curso publicado no instante em que é
  // criado apareceria vazio para quem já tem matrícula.
  const { error } = await supabase.from("courses").insert({
    slug: parsed.data.slug,
    title_pt: parsed.data.titlePt,
    title_en: parsed.data.titleEn,
    status: "draft",
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? copy.duplicateCourse
          : copy.createCourseFailed,
    };
  }

  revalidatePath("/admin/cursos");
  return { success: copy.courseCreated };
}

export async function updateCourseAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.updateCourseSchema.safeParse({
    courseId: formData.get("courseId"),
    titlePt: formData.get("titlePt"),
    titleEn: formData.get("titleEn"),
    descriptionPt: formData.get("descriptionPt") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({
      title_pt: parsed.data.titlePt,
      title_en: parsed.data.titleEn,
      description_pt: parsed.data.descriptionPt,
      description_en: parsed.data.descriptionEn,
    })
    .eq("id", parsed.data.courseId);

  if (error) return { error: copy.saveCourseFailed };

  revalidatePath(`/admin/cursos/${parsed.data.courseId}`);
  revalidatePath("/admin/cursos");
  return { success: copy.courseUpdated };
}

export async function createModuleAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.createModuleSchema.safeParse({
    courseId: formData.get("courseId"),
    titlePt: formData.get("titlePt"),
    titleEn: formData.get("titleEn"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();

  /* Uma chamada só. `create_module` calcula a posição DENTRO do mesmo comando
   * que grava a linha e segura um advisory lock no curso, então duas criações
   * simultâneas entram em fila em vez de disputarem a mesma posição.
   *
   * Aqui existia um laço de até três tentativas tratando 23505. Ele foi
   * escrito quando a posição vinha de `next_module_order()` numa chamada
   * separada — reduzia a janela, não a fechava. Com a corrida resolvida no
   * banco, o laço virava rede para um caso que não acontece mais.
   *
   * `security invoker`: a policy course_modules_insert_admin continua sendo
   * quem autoriza. O is_admin() dentro da função só existe para a mensagem de
   * erro ser legível. */
  const { error } = await supabase.rpc("create_module", {
    p_course_id: parsed.data.courseId,
    p_title_pt: parsed.data.titlePt,
    p_title_en: parsed.data.titleEn,
  });

  if (error) return { error: copy.createModuleFailed };

  revalidatePath(`/admin/cursos/${parsed.data.courseId}`);
  return { success: copy.moduleCreated };
}

export async function updateModuleAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.updateModuleSchema.safeParse({
    moduleId: formData.get("moduleId"),
    titlePt: formData.get("titlePt"),
    titleEn: formData.get("titleEn"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("course_modules")
    .update({ title_pt: parsed.data.titlePt, title_en: parsed.data.titleEn })
    .eq("id", parsed.data.moduleId);

  if (error) return { error: copy.saveModuleFailed };

  revalidateCourse(formData);
  return { success: copy.moduleUpdated };
}

export async function deleteModuleAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.moduleIdSchema.safeParse({ moduleId: formData.get("moduleId") });
  if (!parsed.success) return { error: copy.invalidModule };

  const supabase = await createClient();

  // Um módulo com aulas leva as aulas junto (ON DELETE CASCADE) e, com elas, o
  // progresso dos alunos. Isso não pode acontecer por um clique distraído.
  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("module_id", parsed.data.moduleId);

  if ((count ?? 0) > 0) {
    return {
      error: copy.moduleHasLessons,
    };
  }

  const { error } = await supabase
    .from("course_modules")
    .delete()
    .eq("id", parsed.data.moduleId);

  if (error) return { error: copy.deleteModuleFailed };

  revalidateCourse(formData);
  return { success: copy.moduleDeleted };
}

export async function createLessonAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.createLessonSchema.safeParse({
    moduleId: formData.get("moduleId"),
    titlePt: formData.get("titlePt"),
    titleEn: formData.get("titleEn"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();

  /* Mesma história do createModuleAction: uma chamada só, posição calculada no
   * banco sob advisory lock do módulo.
   *
   * `status` não é passado: a função sempre cria como rascunho. Uma aula
   * publicada no instante da criação entraria na sequência do aluno sem título
   * revisado e sem vídeo, então isso deixou de ser escolha de quem chama e
   * virou regra do banco. */
  const { error } = await supabase.rpc("create_lesson", {
    p_module_id: parsed.data.moduleId,
    p_title_pt: parsed.data.titlePt,
    p_title_en: parsed.data.titleEn,
  });

  if (error) return { error: copy.createLessonFailed };

  revalidateCourse(formData);
  return { success: copy.lessonCreated };
}

export async function updateLessonAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.updateLessonSchema.safeParse({
    lessonId: formData.get("lessonId"),
    titlePt: formData.get("titlePt"),
    titleEn: formData.get("titleEn"),
    descriptionPt: formData.get("descriptionPt") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    status: formData.get("status"),
    durationMinutes: formData.get("durationMinutes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title_pt: parsed.data.titlePt,
      title_en: parsed.data.titleEn,
      description_pt: parsed.data.descriptionPt,
      description_en: parsed.data.descriptionEn,
      status: parsed.data.status,
      // O formulário fala em minutos; a coluna guarda segundos.
      duration_seconds:
        parsed.data.durationMinutes === null ? null : parsed.data.durationMinutes * 60,
    })
    .eq("id", parsed.data.lessonId);

  if (error) return { error: copy.saveLessonFailed };

  revalidateCourse(formData);
  return { success: copy.lessonUpdated };
}

export async function deleteLessonAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.lessonIdSchema.safeParse({ lessonId: formData.get("lessonId") });
  if (!parsed.success) return { error: copy.invalidLesson };

  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", parsed.data.lessonId);

  if (error) return { error: copy.deleteLessonFailed };

  revalidateCourse(formData);
  return { success: copy.lessonDeleted };
}

export async function moveModuleAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.moveSchema.safeParse({
    id: formData.get("moduleId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return { error: copy.invalidData };

  const supabase = await createClient();
  // A troca acontece no banco, numa transação só — ver a migration
  // 20260803221619_admin_content_ordering.sql. Feita daqui, em três chamadas
  // separadas, uma falha no meio deixaria a ordem quebrada em produção.
  const { data, error } = await supabase.rpc("move_module", {
    p_module_id: parsed.data.id,
    p_direction: parsed.data.direction,
  });

  if (error) return { error: copy.reorderModuleFailed };
  if (data === false) return undefined; // já é o primeiro/último — não é erro

  revalidateCourse(formData);
  return { success: copy.orderUpdated };
}

export async function moveLessonAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.moveSchema.safeParse({
    id: formData.get("lessonId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return { error: copy.invalidData };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_lesson", {
    p_lesson_id: parsed.data.id,
    p_direction: parsed.data.direction,
  });

  if (error) return { error: copy.reorderLessonFailed };
  if (data === false) return undefined;

  revalidateCourse(formData);
  return { success: copy.orderUpdated };
}

/**
 * Cadastra ou troca o vídeo de uma aula.
 *
 * `lesson_media` é a única tabela sem policy nenhuma (RLS nega tudo), então
 * aqui o service_role é obrigatório — e por isso a checagem de admin vem
 * ANTES de qualquer coisa. O trigger do banco acerta `lessons.has_video`
 * sozinho; esta action não escreve nesse campo.
 */
export async function setLessonVideoAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.setLessonVideoSchema.safeParse({
    lessonId: formData.get("lessonId"),
    videoUrl: formData.get("videoUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? copy.invalidData };
  }

  const videoId = parseYouTubeVideoId(parsed.data.videoUrl);
  if (!videoId) {
    return {
      error: copy.invalidYoutube,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("lesson_media").upsert(
    { lesson_id: parsed.data.lessonId, video_provider: "youtube", video_id: videoId },
    { onConflict: "lesson_id" },
  );

  if (error) return { error: copy.saveVideoFailed };

  revalidateCourse(formData);
  return { success: copy.videoSaved };
}

export async function removeLessonVideoAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy, schemas } = await adminActionContext("/admin/cursos");

  const parsed = schemas.lessonIdSchema.safeParse({ lessonId: formData.get("lessonId") });
  if (!parsed.success) return { error: copy.invalidLesson };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lesson_media")
    .delete()
    .eq("lesson_id", parsed.data.lessonId);

  if (error) return { error: copy.removeVideoFailed };

  revalidateCourse(formData);
  return { success: copy.videoRemoved };
}

/** Revalida a página do curso a partir do courseId que o formulário carrega. */
function revalidateCourse(formData: FormData): void {
  const courseId = formData.get("courseId");
  if (typeof courseId === "string" && courseId) {
    revalidatePath(`/admin/cursos/${courseId}`);
  }
  revalidatePath("/admin/cursos");
}

export async function resendPasswordResetAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { copy } = await adminActionContext("/admin/alunos");

  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    return { error: copy.invalidEmail };
  }

  const supabase = await createClient();
  const { siteUrl } = getSupabaseEnv();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/redefinir-senha")}`,
  });

  if (error) return { error: copy.sendResetFailed };

  return { success: formatAdminMessage(copy.resetSent, { email }) };
}
