import type { Metadata } from "next";
import { PageHeader, Panel, SectionHeading } from "@/components/platform/ui";
import { studentContent } from "@/content/student";
import { requireStudent } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireStudent("/aluno/ajuda");
  return { title: studentContent[auth.locale].meta.help };
}

export default async function StudentHelpPage() {
  const auth = await requireStudent("/aluno/ajuda");
  const copy = studentContent[auth.locale].help;

  return (
    <div>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <section className="mt-10">
        <SectionHeading title={copy.faqTitle} />
        <div className="mt-5 space-y-3">
          {copy.faqs.map(([question, answer]) => (
            <details key={question} className="group rounded-[3px] border border-panel-line bg-panel">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-warm-white [&::-webkit-details-marker]:hidden">
                <span>{question}</span>
                <span aria-hidden="true" className="text-gold transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="measure border-t border-panel-line px-5 py-4 text-sm leading-relaxed text-ash">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <Panel className="mt-10 flex flex-col gap-5 border-l-2 border-l-gold p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="display text-[1.25rem] text-warm-white">{copy.contactTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ash">{copy.contactBody}</p>
        </div>
        <a
          href="mailto:contact@bmaxy.com"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[3px] bg-gold px-5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-void transition-colors hover:bg-gold-hi"
        >
          {copy.emailCta}
        </a>
      </Panel>
    </div>
  );
}
