import { z } from "zod";
import { adminContent } from "@/content/admin";
import type { PlatformLocale } from "@/content/platform";

export function createAdminValidation(locale: PlatformLocale) {
  const messages = adminContent[locale].validation;
  const slugField = z
    .string()
    .trim()
    .min(3, messages.slugMinimum)
    .max(60, messages.slugMaximum)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, messages.slugFormat);

  return {
    createStudentSchema: z.object({
      fullName: z.string().trim().min(1, messages.studentName),
      email: z.string().trim().min(1, messages.emailRequired).email(messages.emailInvalid),
      temporaryPassword: z.string().min(8, messages.temporaryPassword),
    }),
    updateStudentNameSchema: z.object({
      userId: z.string().uuid(),
      fullName: z.string().trim().min(1, messages.studentName),
    }),
    enrollmentActionSchema: z.object({ userId: z.string().uuid(), courseId: z.string().uuid() }),
    revokeEnrollmentSchema: z.object({ enrollmentId: z.string().uuid() }),
    lessonStatusSchema: z.object({
      lessonId: z.string().uuid(),
      status: z.enum(["draft", "coming_soon", "published"]),
    }),
    courseStatusSchema: z.object({
      courseId: z.string().uuid(),
      status: z.enum(["draft", "published"]),
    }),
    createCourseSchema: z.object({
      slug: slugField,
      titlePt: z.string().trim().min(1, messages.titlePt),
      titleEn: z.string().trim().min(1, messages.titleEn),
    }),
    updateCourseSchema: z.object({
      courseId: z.string().uuid(),
      titlePt: z.string().trim().min(1, messages.titlePt),
      titleEn: z.string().trim().min(1, messages.titleEn),
      descriptionPt: z.string().trim().max(2000, messages.descriptionLong),
      descriptionEn: z.string().trim().max(2000, messages.descriptionLong),
    }),
    createModuleSchema: z.object({
      courseId: z.string().uuid(),
      titlePt: z.string().trim().min(1, messages.moduleTitlePt),
      titleEn: z.string().trim().min(1, messages.moduleTitleEn),
    }),
    updateModuleSchema: z.object({
      moduleId: z.string().uuid(),
      titlePt: z.string().trim().min(1, messages.moduleTitlePt),
      titleEn: z.string().trim().min(1, messages.moduleTitleEn),
    }),
    moduleIdSchema: z.object({ moduleId: z.string().uuid() }),
    lessonIdSchema: z.object({ lessonId: z.string().uuid() }),
    moveSchema: z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }),
    createLessonSchema: z.object({
      moduleId: z.string().uuid(),
      titlePt: z.string().trim().min(1, messages.lessonTitlePt),
      titleEn: z.string().trim().min(1, messages.lessonTitleEn),
    }),
    updateLessonSchema: z.object({
      lessonId: z.string().uuid(),
      titlePt: z.string().trim().min(1, messages.lessonTitlePt),
      titleEn: z.string().trim().min(1, messages.lessonTitleEn),
      descriptionPt: z.string().trim().max(2000, messages.descriptionLong),
      descriptionEn: z.string().trim().max(2000, messages.descriptionLong),
      status: z.enum(["draft", "coming_soon", "published"]),
      durationMinutes: z
        .union([z.literal(""), z.coerce.number().int().min(0).max(600)])
        .transform((value) => (value === "" ? null : value)),
    }),
    setLessonVideoSchema: z.object({
      lessonId: z.string().uuid(),
      videoUrl: z.string().trim().min(1, messages.youtubeLink),
    }),
  };
}

// Compatibilidade: imports existentes e testes continuam recebendo PT-BR.
const pt = createAdminValidation("pt");
export const {
  createStudentSchema,
  updateStudentNameSchema,
  enrollmentActionSchema,
  revokeEnrollmentSchema,
  lessonStatusSchema,
  courseStatusSchema,
  createCourseSchema,
  updateCourseSchema,
  createModuleSchema,
  updateModuleSchema,
  moduleIdSchema,
  lessonIdSchema,
  moveSchema,
  createLessonSchema,
  updateLessonSchema,
  setLessonVideoSchema,
} = pt;
