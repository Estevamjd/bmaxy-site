import Image from "next/image";
import { Mail, Plus } from "@/components/icons";
import PageIntro from "@/components/pages/PageIntro";
import { ButtonPrimary, PlusCorners, SectionEyebrow } from "@/components/ui";
import { contactMailto, type Locale, type SiteContent } from "@/content/site";
import { revealDelay } from "@/lib/reveal";

/**
 * `/sobre` e `/en/about`.
 *
 * A história vem de `site.about.paragraphs` — a MESMA da home, de propósito:
 * é o texto do próprio autor, já aprovado, e reescrevê-lo aqui criaria duas
 * biografias que iriam divergir na primeira correção.
 *
 * O que esta página acrescenta à home: as quatro frentes de atuação, o bloco
 * de missão da BMaxy e os dois CTAs (livros e contato). Nenhuma data, prêmio,
 * nome de cliente ou resultado numérico — ver a nota em site.ts.
 */
export default function AboutPage({
  site,
  locale,
}: {
  site: SiteContent;
  locale: Locale;
}) {
  const page = site.pages.about;

  return (
    <>
      <PageIntro
        site={site}
        locale={locale}
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.lead}
      />

      {/* ----------------------- retrato + história ------------------------ */}
      <section className="section-y bg-void pt-16 md:pt-20">
        <div className="container-site">
          <div className="grid gap-14 lg:grid-cols-12 lg:items-start lg:gap-x-16">
            <div className="relative lg:col-span-5" data-reveal style={revealDelay(0)}>
              <PlusCorners tone="gold" />
              <div className="aspect-[4/5] w-full overflow-hidden bg-deep-surface lg:aspect-[3/4]">
                <Image
                  src={page.portrait.src}
                  alt={page.portrait.alt}
                  width={page.portrait.width}
                  height={page.portrait.height}
                  sizes="(min-width: 1024px) 42vw, 100vw"
                  priority
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <p className="label-eyebrow text-ash">{page.storyLabel}</p>
              <div className="mt-8 space-y-6">
                {site.about.paragraphs.map((paragraph, index) => (
                  <p
                    key={paragraph.slice(0, 24)}
                    className="measure text-[1.0625rem] leading-relaxed text-white/85 md:text-lg"
                    data-reveal
                    style={revealDelay(index + 1)}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- atuação ------------------------------- */}
      <section className="section-y bg-deep-surface">
        <div className="container-site">
          <SectionEyebrow as="h2" label={page.rolesLabel} tone="deep" />

          <ul className="mt-12 grid gap-x-10 md:mt-16 md:grid-cols-2 xl:grid-cols-4">
            {page.roles.map((role, index) => (
              <li
                key={role.number}
                className="relative border-t border-white/15 py-8"
                data-reveal
                style={revealDelay(index, 70)}
              >
                <Plus className="absolute -left-[7px] -top-[7px] h-3.5 w-3.5 text-gold" />
                <p className="label-eyebrow text-gold">{role.number}</p>
                <h3 className="display mt-4 text-[1.5rem] leading-tight text-white">
                  {role.title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-white/75">
                  {role.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------- missão ------------------------------- */}
      <section className="section-y bg-bone text-ink">
        <div className="container-site">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionEyebrow label={page.mission.label} tone="light" />
              <h2 className="display t-section mt-6 text-ink">
                {page.mission.title}
              </h2>
            </div>

            <div className="space-y-6 lg:col-span-6 lg:col-start-7">
              {page.mission.paragraphs.map((paragraph, index) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="measure text-[1.0625rem] leading-relaxed text-ink-soft md:text-lg"
                  data-reveal
                  style={revealDelay(index)}
                >
                  {paragraph}
                </p>
              ))}

              <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
                <ButtonPrimary href={page.booksCta.href}>
                  {page.booksCta.label}
                </ButtonPrimary>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- contato ------------------------------ */}
      <section className="section-y bg-void">
        <div className="container-site">
          <div className="relative border border-line p-8 md:p-12">
            <PlusCorners tone="gold" />
            <SectionEyebrow label={page.contactLabel} />

            <p className="measure mt-6 text-[1.0625rem] leading-relaxed text-ash md:text-lg">
              {page.contactNote}
            </p>

            {/* mailto real, o mesmo endereço do rodapé — sem formulário de
                contato, porque não há backend para receber um. É <a> puro e
                não <Link>/ButtonGhost: `mailto:` não é rota do App Router. */}
            <a
              href={contactMailto(site)}
              className="group mt-8 inline-flex min-h-11 items-center gap-3 text-white transition-colors duration-300 hover:text-gold"
            >
              <Mail className="h-5 w-5 shrink-0" />
              <span className="display text-[1.375rem] md:text-[1.75rem]">
                <span className="link-underline">{site.footer.contact.email}</span>
              </span>
            </a>

            <div className="mt-10">
              <a
                href={contactMailto(site)}
                className="inline-flex min-h-11 items-center justify-center rounded-[2px] border border-white/40 px-7 py-4 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-white transition-colors duration-300 hover:border-gold hover:text-gold md:text-xs"
              >
                {page.contactCta}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
