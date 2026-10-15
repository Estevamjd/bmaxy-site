import { Instagram } from "@/components/icons";
import { PlusCorners, SectionEyebrow } from "@/components/ui";
import type { SiteContent } from "@/content/site";
import { revealDelay } from "@/lib/reveal";

/** Editorial process, deliberately typographic: no simulated social feed. */
export default function BehindThePages({ site }: { site: SiteContent }) {
  const { behind } = site;

  return (
    <section id="processo-editorial" className="section-y bg-void">
      <div className="container-site">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="lg:col-span-7">
            <SectionEyebrow index={behind.index} label={behind.label} />
            <h2 className="display t-section mt-6 text-white">{behind.title}</h2>
          </div>
          <p className="measure text-[1.0625rem] leading-relaxed text-ash lg:col-span-5 lg:pb-3">
            {behind.lead}
          </p>
        </div>

        <div className="mt-14 md:mt-20">
          <p className="label-eyebrow text-ash">{behind.stagesLabel}</p>
          <ol className="mt-8 grid border-b border-line md:grid-cols-2 lg:grid-cols-4">
            {behind.stages.map((stage, index) => (
              <li
                key={stage.number}
                className="relative border-t border-line py-8 md:px-6 md:first:pl-0 md:[&:nth-child(odd)]:border-r lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
                data-reveal
                style={revealDelay(index, 70)}
              >
                <p className="display text-[3.75rem] leading-none text-gold/30 md:text-[4.5rem]">
                  {stage.number}
                </p>
                <h3 className="display mt-7 text-[1.5rem] leading-tight text-white">
                  {stage.title}
                </h3>
                <p className="measure mt-4 text-[0.9375rem] leading-relaxed text-ash">
                  {stage.text}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative mt-14 flex flex-col items-start gap-8 border border-line p-8 md:mt-16 md:flex-row md:items-center md:justify-between md:p-10">
          <PlusCorners tone="gold" />
          <a
            href={behind.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-4"
          >
            <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[2px] border border-line text-white transition-colors group-hover:border-gold group-hover:text-gold">
              <Instagram className="h-6 w-6" />
            </span>
            <span>
              <span className="label-eyebrow block text-ash">{behind.handleLabel}</span>
              <span className="display mt-1 block text-xl text-white transition-colors group-hover:text-gold md:text-2xl">
                <span className="link-underline">{behind.handle}</span>
              </span>
              <span className="mt-2 block max-w-md text-sm leading-relaxed text-ash">
                {behind.socialText}
              </span>
            </span>
            <span className="sr-only"> {site.a11y.externalLinkHint}</span>
          </a>

          <a
            href={behind.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center rounded-[2px] bg-gold px-6 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-void transition-colors hover:bg-gold-hi"
          >
            {behind.cta}
            <span className="sr-only"> {site.a11y.externalLinkHint}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
