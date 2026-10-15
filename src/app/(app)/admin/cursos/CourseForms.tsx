"use client";

import { useState } from "react";
import {
  ActionForm,
  DangerActionForm,
  Field,
  IconSubmitButton,
  SelectField,
  SubmitButton,
  TextAreaField,
} from "@/components/platform/AdminForms";
import { IconArrowDown, IconArrowUp, IconPlus } from "@/components/platform/icons";
import { buttonStyles } from "@/components/platform/ui";
import { formatAdminMessage, type AdminContent } from "@/content/admin";
import {
  createCourseAction,
  createLessonAction,
  createModuleAction,
  deleteLessonAction,
  deleteModuleAction,
  moveLessonAction,
  moveModuleAction,
  removeLessonVideoAction,
  setLessonVideoAction,
  updateCourseAction,
  updateCourseStatusAction,
  updateLessonAction,
  updateModuleAction,
} from "@/lib/actions/admin";

/**
 * Formulários do editor de curso.
 *
 * Um padrão se repete e é proposital: o que é raro (criar módulo, criar aula,
 * editar aula) fica atrás de um botão que revela o formulário. Um editor com
 * oito formulários abertos ao mesmo tempo é impossível de ler, e o
 * administrador passa a maior parte do tempo só olhando a estrutura.
 *
 * Toda ação daqui chama uma Server Action que começa com `requireAdmin()`.
 * Esconder ou revelar formulário é conforto visual, nunca controle de acesso.
 */

/* -------------------------------------------------------------------------- */
/*  Revelar/esconder                                                          */
/* -------------------------------------------------------------------------- */

function Disclosure({
  label,
  cancelLabel,
  children,
  tone = "secondary",
}: {
  label: string;
  cancelLabel: string;
  children: React.ReactNode;
  tone?: "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonStyles[tone]}>
        <IconPlus className="h-4 w-4" />
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-[3px] border border-panel-line bg-panel-hi p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="label-eyebrow text-ash">{label}</p>
        <button type="button" onClick={() => setOpen(false)} className={buttonStyles.ghost}>
          {cancelLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Curso                                                                     */
/* -------------------------------------------------------------------------- */

export function CreateCourseForm({ content }: { content: AdminContent }) {
  const copy = content.courses.forms;

  return (
    <Disclosure label={copy.newCourse} cancelLabel={content.common.cancel}>
      <ActionForm action={createCourseAction} className="space-y-4" noticePosition="bottom">
        <Field
          label={copy.slug}
          name="slug"
          type="text"
          required
          placeholder="seu-livro"
          hint={copy.slugHint}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.titlePt} name="titlePt" type="text" required />
          <Field label={copy.titleEn} name="titleEn" type="text" required />
        </div>
        <SubmitButton pendingLabel={content.common.creating}>{copy.createCourse}</SubmitButton>
        <p className="text-xs text-ash">{copy.draftCourseHint}</p>
      </ActionForm>
    </Disclosure>
  );
}

export function EditCourseForm({
  courseId,
  titlePt,
  titleEn,
  descriptionPt,
  descriptionEn,
  content,
}: {
  courseId: string;
  titlePt: string;
  titleEn: string;
  descriptionPt: string;
  descriptionEn: string;
  content: AdminContent;
}) {
  const copy = content.courses.forms;

  return (
    <ActionForm
      action={updateCourseAction}
      hidden={{ courseId }}
      className="space-y-4"
      noticePosition="bottom"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.titlePt} name="titlePt" type="text" defaultValue={titlePt} required />
        <Field label={copy.titleEn} name="titleEn" type="text" defaultValue={titleEn} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField label={copy.descriptionPt} name="descriptionPt" defaultValue={descriptionPt} />
        <TextAreaField label={copy.descriptionEn} name="descriptionEn" defaultValue={descriptionEn} />
      </div>
      <SubmitButton tone="secondary" pendingLabel={content.common.saving}>
        {copy.saveCourse}
      </SubmitButton>
    </ActionForm>
  );
}

export function CourseStatusForm({
  courseId,
  status,
  activeStudentCount,
  content,
}: {
  courseId: string;
  status: "draft" | "published";
  activeStudentCount: number;
  content: AdminContent;
}) {
  const copy = content.courses.forms;

  return (
    <ActionForm
      action={updateCourseStatusAction}
      hidden={{ courseId }}
      className="space-y-4"
      noticePosition="bottom"
    >
      <div className="max-w-xs">
        <SelectField
          label={copy.courseStatus}
          name="status"
          defaultValue={status}
          options={[
            { value: "draft", label: copy.courseDraft },
            { value: "published", label: copy.coursePublished },
          ]}
        />
      </div>
      {/* Voltar um curso publicado para rascunho tira o acesso de quem já
          estuda. O número de afetados precisa estar à vista na hora da
          decisão, não escondido em outra tela. */}
      {status === "published" && activeStudentCount > 0 ? (
        <p className="text-xs leading-relaxed text-amber-300">
          {activeStudentCount === 1
            ? copy.activeWarningOne
            : formatAdminMessage(copy.activeWarningMany, { count: activeStudentCount })}
        </p>
      ) : null}
      <SubmitButton tone="secondary" pendingLabel={content.common.saving}>
        {copy.saveStatus}
      </SubmitButton>
    </ActionForm>
  );
}

/* -------------------------------------------------------------------------- */
/*  Módulos                                                                   */
/* -------------------------------------------------------------------------- */

export function CreateModuleForm({
  courseId,
  content,
}: {
  courseId: string;
  content: AdminContent;
}) {
  const copy = content.courses.forms;

  return (
    <Disclosure label={copy.newModule} cancelLabel={content.common.cancel}>
      <ActionForm
        action={createModuleAction}
        hidden={{ courseId }}
        className="space-y-4"
        noticePosition="bottom"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.titlePt} name="titlePt" type="text" required />
          <Field label={copy.titleEn} name="titleEn" type="text" required />
        </div>
        <SubmitButton pendingLabel={content.common.creating}>{copy.newModule}</SubmitButton>
      </ActionForm>
    </Disclosure>
  );
}

export function EditModuleForm({
  moduleId,
  courseId,
  titlePt,
  titleEn,
  content,
}: {
  moduleId: string;
  courseId: string;
  titlePt: string;
  titleEn: string;
  content: AdminContent;
}) {
  const copy = content.courses.forms;

  return (
    <Disclosure label={copy.editModule} cancelLabel={content.common.cancel} tone="ghost">
      <ActionForm
        action={updateModuleAction}
        hidden={{ moduleId, courseId }}
        className="space-y-4"
        noticePosition="bottom"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.titlePt} name="titlePt" type="text" defaultValue={titlePt} required />
          <Field label={copy.titleEn} name="titleEn" type="text" defaultValue={titleEn} required />
        </div>
        <SubmitButton tone="secondary" pendingLabel={content.common.saving}>
          {copy.saveModule}
        </SubmitButton>
      </ActionForm>
    </Disclosure>
  );
}

export function DeleteModuleForm({
  moduleId,
  courseId,
  title,
  lessonCount,
  content,
}: {
  moduleId: string;
  courseId: string;
  title: string;
  lessonCount: number;
  content: AdminContent;
}) {
  const copy = content.courses.forms;

  return (
    <DangerActionForm
      action={deleteModuleAction}
      hidden={{ moduleId, courseId }}
      triggerLabel={copy.delete}
      title={formatAdminMessage(copy.deleteModuleTitle, { title })}
      description={
        lessonCount > 0
          ? formatAdminMessage(copy.deleteModuleWithLessons, { count: lessonCount })
          : copy.deleteModuleEmpty
      }
      confirmLabel={copy.deleteModule}
      cancelLabel={content.common.cancel}
      pendingLabel={content.common.wait}
    />
  );
}

export function MoveButtons({
  kind,
  id,
  courseId,
  isFirst,
  isLast,
  content,
}: {
  kind: "module" | "lesson";
  id: string;
  courseId: string;
  isFirst: boolean;
  isLast: boolean;
  content: AdminContent;
}) {
  const action = kind === "module" ? moveModuleAction : moveLessonAction;
  const idField = kind === "module" ? "moduleId" : "lessonId";
  const copy = content.courses.forms;
  const noun = kind === "module" ? copy.moduleNoun : copy.lessonNoun;

  return (
    <div className="flex items-center gap-1">
      <ActionForm action={action} hidden={{ [idField]: id, courseId, direction: "up" }}>
        <IconSubmitButton
          label={formatAdminMessage(copy.moveUp, { noun })}
          disabled={isFirst}
        >
          <IconArrowUp className="h-4 w-4" />
        </IconSubmitButton>
      </ActionForm>
      <ActionForm action={action} hidden={{ [idField]: id, courseId, direction: "down" }}>
        <IconSubmitButton
          label={formatAdminMessage(copy.moveDown, { noun })}
          disabled={isLast}
        >
          <IconArrowDown className="h-4 w-4" />
        </IconSubmitButton>
      </ActionForm>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Aulas                                                                     */
/* -------------------------------------------------------------------------- */

export function CreateLessonForm({
  moduleId,
  courseId,
  content,
}: {
  moduleId: string;
  courseId: string;
  content: AdminContent;
}) {
  const copy = content.courses.forms;

  return (
    <Disclosure label={copy.newLesson} cancelLabel={content.common.cancel} tone="ghost">
      <ActionForm
        action={createLessonAction}
        hidden={{ moduleId, courseId }}
        className="space-y-4"
        noticePosition="bottom"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.titlePt} name="titlePt" type="text" required />
          <Field label={copy.titleEn} name="titleEn" type="text" required />
        </div>
        <SubmitButton pendingLabel={content.common.creating}>{copy.newLesson}</SubmitButton>
        <p className="text-xs text-ash">{copy.draftLessonHint}</p>
      </ActionForm>
    </Disclosure>
  );
}

export function EditLessonForm({
  lessonId,
  courseId,
  titlePt,
  titleEn,
  descriptionPt,
  descriptionEn,
  status,
  durationSeconds,
  hasVideo,
  content,
}: {
  lessonId: string;
  courseId: string;
  titlePt: string;
  titleEn: string;
  descriptionPt: string;
  descriptionEn: string;
  status: "draft" | "coming_soon" | "published";
  durationSeconds: number | null;
  hasVideo: boolean;
  content: AdminContent;
}) {
  const durationMinutes = durationSeconds ? Math.round(durationSeconds / 60) : "";
  const copy = content.courses.forms;

  return (
    <Disclosure label={copy.editLesson} cancelLabel={content.common.cancel} tone="ghost">
      <ActionForm
        action={updateLessonAction}
        hidden={{ lessonId, courseId }}
        className="space-y-4"
        noticePosition="bottom"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.titlePt} name="titlePt" type="text" defaultValue={titlePt} required />
          <Field label={copy.titleEn} name="titleEn" type="text" defaultValue={titleEn} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextAreaField label={copy.descriptionPt} name="descriptionPt" defaultValue={descriptionPt} />
          <TextAreaField label={copy.descriptionEn} name="descriptionEn" defaultValue={descriptionEn} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={copy.status}
            name="status"
            defaultValue={status}
            options={[
              { value: "draft", label: copy.lessonDraft },
              { value: "coming_soon", label: copy.lessonComingSoon },
              { value: "published", label: copy.lessonPublished },
            ]}
            hint={
              !hasVideo
                ? copy.missingVideoHint
                : undefined
            }
          />
          <Field
            label={copy.duration}
            name="durationMinutes"
            type="number"
            min={0}
            max={600}
            defaultValue={durationMinutes}
            hint={copy.durationHint}
          />
        </div>
        <SubmitButton tone="secondary" pendingLabel={content.common.saving}>
          {copy.saveLesson}
        </SubmitButton>
      </ActionForm>
    </Disclosure>
  );
}

export function DeleteLessonForm({
  lessonId,
  courseId,
  title,
  content,
}: {
  lessonId: string;
  courseId: string;
  title: string;
  content: AdminContent;
}) {
  const copy = content.courses.forms;

  return (
    <DangerActionForm
      action={deleteLessonAction}
      hidden={{ lessonId, courseId }}
      triggerLabel={copy.delete}
      title={formatAdminMessage(copy.deleteLessonTitle, { title })}
      description={copy.deleteLessonDescription}
      confirmLabel={copy.deleteLesson}
      cancelLabel={content.common.cancel}
      pendingLabel={content.common.wait}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Vídeo                                                                     */
/* -------------------------------------------------------------------------- */

export function LessonVideoForm({
  lessonId,
  courseId,
  hasVideo,
  content,
}: {
  lessonId: string;
  courseId: string;
  hasVideo: boolean;
  content: AdminContent;
}) {
  const copy = content.courses.forms;

  return (
    <Disclosure
      label={hasVideo ? copy.replaceVideo : copy.addVideo}
      cancelLabel={content.common.cancel}
      tone="ghost"
    >
      <div className="space-y-4">
        <ActionForm
          action={setLessonVideoAction}
          hidden={{ lessonId, courseId }}
          className="space-y-4"
          noticePosition="bottom"
        >
          <Field
            label={copy.youtubeLink}
            name="videoUrl"
            type="text"
            required
            placeholder="https://www.youtube.com/watch?v=..."
            hint={copy.youtubeHint}
          />
          <SubmitButton pendingLabel={content.common.saving}>
            {hasVideo ? copy.replaceVideo : copy.addVideo}
          </SubmitButton>
        </ActionForm>

        {hasVideo ? (
          <div className="border-t border-panel-line pt-4">
            <DangerActionForm
              action={removeLessonVideoAction}
              hidden={{ lessonId, courseId }}
              triggerLabel={copy.removeVideo}
              title={copy.removeVideoTitle}
              description={copy.removeVideoDescription}
              confirmLabel={copy.removeVideo}
              cancelLabel={content.common.cancel}
              pendingLabel={content.common.wait}
            />
          </div>
        ) : null}

        {/* O ID em si NUNCA é exibido nem devolvido ao navegador: ele vive em
            lesson_media, que nem a sessão do administrador lê pela API. */}
        <p className="text-xs leading-relaxed text-ash">{copy.privateVideoNote}</p>
      </div>
    </Disclosure>
  );
}
