import type { Metadata } from "next";
import { adminContent } from "@/content/admin";
import { requireAdmin } from "@/lib/auth/session";
import { InfoNotice, PageHeader } from "@/components/platform/ui";
import { CreateStudentForm } from "./CreateStudentForm";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireAdmin("/admin/alunos/novo");
  return { title: adminContent[auth.locale].meta.newStudent };
}

export default async function NewStudentPage() {
  const auth = await requireAdmin("/admin/alunos/novo");
  const copy = adminContent[auth.locale];
  const text = copy.students.new;
  return (
    <div>
      <PageHeader
        eyebrow={copy.common.management}
        title={text.title}
        description={text.description}
        backHref="/admin/alunos"
        backLabel={text.back}
      />

      <div className="mt-8 max-w-md">
        {/* A diferença entre as duas portas de entrada precisa estar escrita
            aqui, não descoberta depois: quem se cadastra pelo site ganha a
            matrícula gratuita automaticamente; quem é criado aqui, não. */}
        <InfoNotice>
          {text.noticePrefix}{" "}
          <strong className="text-warm-white">{text.noticeStrong}</strong>
          {text.noticeSuffix}
        </InfoNotice>
      </div>

      <div className="mt-6">
        <CreateStudentForm content={copy} />
      </div>
    </div>
  );
}
