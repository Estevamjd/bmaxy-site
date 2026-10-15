import { Mail, Plus } from "@/components/icons";
import PageIntro from "@/components/pages/PageIntro";
import { PlusCorners, SectionEyebrow } from "@/components/ui";
import { blockKey, type LegalDocument } from "@/content/legal";
import { contactMailto, type Locale, type SiteContent } from "@/content/site";

/**
 * As quatro rotas jurídicas: `/termos`, `/privacidade`, `/en/terms` e
 * `/en/privacy`.
 *
 * O desenho nasceu repetido nas quatro páginas e virou este componente — o
 * mesmo caminho de AboutPage e ServicePage. Um documento jurídico é o pior
 * lugar possível para manter quatro cópias de um renderizador: a divergência
 * não apareceria como bug de layout, e sim como uma cláusula que existe em um
 * idioma e não no outro.
 *
 * Nenhuma string vive aqui. Todo o texto está em `src/content/legal.ts`,
 * mesma regra de `site.ts`.
 */
export default function LegalPage({
  site,
  locale,
  doc,
}: {
  site: SiteContent;
  locale: Locale;
  doc: LegalDocument;
}) {
  return (
    <>
      <PageIntro
        site={site}
        locale={locale}
        eyebrow={doc.eyebrow}
        title={doc.title}
        lead={doc.lead}
      >
        <p className="label-eyebrow flex flex-wrap items-center gap-2 text-ash">
          <Plus className="h-3 w-3 shrink-0 text-gold" />
          <span>{doc.updatedLabel}</span>
          <time dateTime={doc.updatedAtISO} className="text-white">
            {doc.updatedAt}
          </time>
        </p>
      </PageIntro>

      <section className="section-y bg-void pt-14 md:pt-16">
        <div className="container-site">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-16">
            {/* ------------------------ índice do documento ----------------- */}
            {/* Sem `sticky`: com dezoito cláusulas o índice fica mais alto que
                a janela, e um elemento grudado maior que a viewport esconde o
                próprio fim. */}
            <nav aria-label={doc.summaryLabel} className="lg:col-span-4">
              <SectionEyebrow as="h2" label={doc.summaryLabel} />

              <ol className="mt-6 border-t border-line">
                {doc.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="group flex items-baseline gap-3 border-b border-line py-3 text-[0.9375rem] leading-snug text-white/80 transition-colors duration-300 hover:text-gold"
                    >
                      <span className="label-eyebrow shrink-0 text-gold">
                        {section.number}
                      </span>
                      <span className="link-underline">{section.heading}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {/* ---------------------------- cláusulas ----------------------- */}
            <div className="lg:col-span-7 lg:col-start-6">
              {doc.sections.map((clause) => (
                <section
                  key={clause.id}
                  id={clause.id}
                  className="border-t border-line py-10 first:border-t-0 first:pt-0 md:py-12"
                >
                  <p className="label-eyebrow text-gold">{clause.number}</p>
                  <h2 className="display mt-4 text-[1.5rem] leading-tight text-white md:text-[1.75rem]">
                    {clause.heading}
                  </h2>

                  <div className="mt-6 space-y-5">
                    {clause.blocks.map((block) =>
                      block.type === "list" ? (
                        <ul key={blockKey(block)} className="space-y-3">
                          {block.items.map((item) => (
                            <li
                              key={item}
                              className="measure flex items-start gap-3 text-[1.0625rem] leading-relaxed text-white/85"
                            >
                              <Plus className="mt-[0.5rem] h-2.5 w-2.5 shrink-0 text-gold" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : block.type === "note" ? (
                        <div
                          key={blockKey(block)}
                          className="measure relative border border-line bg-white/[0.03] p-5 md:p-6"
                        >
                          <PlusCorners tone="gold" />
                          <p className="text-base leading-relaxed text-ash">
                            {block.text}
                          </p>
                        </div>
                      ) : (
                        <p
                          key={blockKey(block)}
                          className="measure text-[1.0625rem] leading-relaxed text-white/85"
                        >
                          {block.text}
                        </p>
                      ),
                    )}
                  </div>
                </section>
              ))}

              {/* mailto real, o mesmo endereço do rodapé — é o único link vivo
                  do documento. Não é <Link>: `mailto:` não é rota do App
                  Router. */}
              <div className="relative mt-8 border border-line p-8 md:p-10">
                <PlusCorners tone="gold" />
                <p className="measure text-[1.0625rem] leading-relaxed text-white/85">
                  {doc.contactNote}
                </p>

                <a
                  href={contactMailto(site)}
                  className="mt-8 inline-flex min-h-11 items-center justify-center gap-3 rounded-[2px] bg-gold px-6 py-4 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-void transition-colors duration-300 hover:bg-gold-hi md:text-xs"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {doc.contactCta}
                </a>

                <p className="mt-5 break-words text-sm text-ash">
                  {site.footer.contact.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
