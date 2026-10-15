import Link from "next/link";
import { PlusCorners, SectionEyebrow, TextLink } from "@/components/ui";
import type { SiteContent } from "@/content/site";
import { revealDelay } from "@/lib/reveal";

/** The three concrete ways a visitor can start a book with BMaxy. */
export default function Paths({ site }: { site: SiteContent }) {
  const { paths } = site;

  return (
    <section id={paths.anchor} className="section-y scroll-mt-24 bg-deep-surface">
      <div className="container-site">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="lg:col-span-7">
            <SectionEyebrow index={paths.index} label={paths.label} tone="deep" />
            <h2 className="display t-section mt-6 text-white">{paths.title}</h2>
          </div>
          <p className="measure text-[1.0625rem] leading-relaxed text-white/70 lg:col-span-5 lg:pb-3">
            {paths.lead}
          </p>
        </div>

        <ol className="mt-14 grid gap-px border border-line bg-line md:mt-20 lg:grid-cols-3">
          {paths.items.map((item, index) => (
            <li
              key={item.number}
              className="group relative flex min-h-full flex-col bg-deep-surface p-7 transition-colors duration-300 hover:bg-void md:p-9"
              data-reveal
              style={revealDelay(index)}
            >
              <PlusCorners tone="gold" />
              <p className="label-eyebrow text-gold">{item.number}</p>
              <h3 className="display mt-8 text-[1.65rem] leading-tight text-white md:text-[1.9rem]">
                {item.title}
              </h3>
              <p className="measure mt-5 flex-1 text-[0.9375rem] leading-relaxed text-white/70">
                {item.text}
              </p>
              <TextLink href={item.cta.href} className="mt-8 self-start">
                {item.cta.label}
              </TextLink>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col gap-5 border-l-2 border-gold bg-void px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p className="measure text-sm leading-relaxed text-white/70">{paths.note}</p>
          <Link
            href={paths.noteCta.href}
            className="shrink-0 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold underline decoration-gold/50 underline-offset-4 transition-colors hover:text-gold-hi"
          >
            {paths.noteCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
