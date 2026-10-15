import Image from "next/image";
import { Mail, Plus } from "@/components/icons";
import PageIntro from "@/components/pages/PageIntro";
import { PlusCorners, SectionEyebrow } from "@/components/ui";
import {
  contactMailto,
  type Locale,
  type ServicePageContent,
  type SiteContent,
} from "@/content/site";
import { revealDelay } from "@/lib/reveal";

/**
 * `/consultoria`, `/ghostwriting` e os equivalentes em inglês — uma peça só,
 * dois conteúdos (`site.pages.consulting` e `site.pages.ghostwriting`).
 *
 * O BLOCO "O QUE AINDA NÃO ESTÁ DEFINIDO" é o coração honesto destas duas
 * páginas. Nenhum dos dois serviços tem formato, prazo, número de páginas,
 * preço ou termos de contrato fechados — então a página DIZ isso, em vez de
 * inventar uma tabela de pacotes que não existe. Se um dia o cliente fechar
 * esses pontos, eles saem de `pendingItems` e viram conteúdo de verdade.
 *
 * O CTA é `mailto:` puro (não <Link>): não há formulário de contato porque
 * não há backend para receber um, e um formulário que não envia nada seria a
 * mesma categoria de problema.
 */
export default function ServicePage({
  site,
  locale,
  content,
}: {
  site: SiteContent;
  locale: Locale;
  content: ServicePageContent;
}) {
  return (
    <>
      <PageIntro
        site={site}
        locale={locale}
        eyebrow={content.eyebrow}
        title={content.title}
        lead={content.lead}
      />

      {/* ------------------------ texto + retrato -------------------------- */}
      <section className="section-y bg-void pt-16 md:pt-20">
        <div className="container-site">
          <div className="grid gap-14 lg:grid-cols-12 lg:items-start lg:gap-x-16">
            <div className="space-y-6 lg:col-span-6">
              {content.paragraphs.map((paragraph, index) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="measure text-[1.0625rem] leading-relaxed text-white/85 md:text-lg"
                  data-reveal
                  style={revealDelay(index)}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div
              className="relative lg:col-span-5 lg:col-start-8"
              data-reveal
              style={revealDelay(1)}
            >
              <PlusCorners tone="gold" />
              {/* Retratos recortados (PNG com fundo transparente) — daí o
                  painel em --deep-surface por baixo. */}
              <div className="aspect-[4/5] w-full overflow-hidden bg-deep-surface">
                <Image
                  src={content.portrait.src}
                  alt={content.portrait.alt}
                  width={content.portrait.width}
                  height={content.portrait.height}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  /* Fica logo abaixo da abertura, dentro da primeira tela em
                     desktop — é o LCP destas duas páginas. */
                  priority
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- etapas ------------------------------- */}
      <section className="section-y bg-deep-surface">
        <div className="container-site">
          <SectionEyebrow as="h2" label={content.stepsLabel} tone="deep" />

          <ol className="mt-12 md:mt-16">
            {content.steps.map((step, index) => (
              <li
                key={step.number}
                className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-white/15 py-7 last:border-b md:grid-cols-12 md:gap-x-8 md:py-9"
                data-reveal
                style={revealDelay(index, 70)}
              >
                <span className="label-eyebrow pt-1.5 text-gold md:col-span-2">
                  {step.number}
                </span>
                <h3 className="display text-[1.375rem] leading-tight text-white md:col-span-4 md:text-[1.625rem]">
                  {step.title}
                </h3>
                <p className="col-start-2 mt-3 text-[0.9375rem] leading-relaxed text-white/75 md:col-span-6 md:col-start-7 md:mt-0 md:text-base">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------- o que ainda não está definido + CTA ---------------- */}
      <section className="section-y bg-void">
        <div className="container-site">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-6">
              <SectionEyebrow as="h2" label={content.pendingLabel} />
              <p className="measure mt-6 text-[1.0625rem] leading-relaxed text-ash">
                {content.pendingIntro}
              </p>

              <ul className="mt-8">
                {content.pendingItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-4 border-t border-line py-5 last:border-b"
                  >
                    <Plus className="mt-1.5 h-3 w-3 shrink-0 text-gold" />
                    <span className="text-[1.0625rem] leading-relaxed text-white/90">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-5 lg:col-start-8">
              <div className="relative border border-line p-8 md:p-10">
                <PlusCorners tone="gold" />
                <p className="measure text-[1.0625rem] leading-relaxed text-white/85">
                  {content.ctaNote}
                </p>

                <a
                  href={contactMailto(site)}
                  className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-[2px] bg-gold px-6 py-4 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-void transition-colors duration-300 hover:bg-gold-hi md:text-xs"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {content.ctaLabel}
                </a>

                <p className="mt-5 break-words text-center text-sm text-ash">
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
