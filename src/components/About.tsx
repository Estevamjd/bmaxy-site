import Image from "next/image";
import { PlusCorners, SectionEyebrow, TextLink } from "@/components/ui";
import type { SiteContent } from "@/content/site";
import { revealDelay } from "@/lib/reveal";

export default function About({ site }: { site: SiteContent }) {
  const { about } = site;

  return (
    <section id="sobre" className="section-y bg-deep-surface">
      <div className="container-site">
        <div className="grid gap-14 lg:grid-cols-12 lg:items-center lg:gap-x-16">
          {/* Retrato. Sem sangria até a borda da tela aqui de propósito: os
              marcadores + ficam nos cantos da foto e sairiam junto com ela. */}
          <div
            className="relative lg:col-span-5"
            data-reveal
            style={revealDelay(0)}
          >
            <PlusCorners tone="gold" />
            {/* Sem .duotone: foto real do cliente — ver nota em Hero.tsx */}
            <div className="aspect-[4/5] w-full overflow-hidden lg:aspect-[3/4]">
              <Image
                src={about.portrait.src}
                alt={about.portrait.alt}
                width={about.portrait.width}
                height={about.portrait.height}
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <SectionEyebrow index={about.index} label={about.label} tone="deep" />
            <h2
              className="display t-section mt-6 text-white"
              data-reveal
              style={revealDelay(1)}
            >
              {about.title}
            </h2>

            <div className="mt-10 space-y-6">
              {about.paragraphs.map((paragraph, index) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="measure text-[1.0625rem] leading-relaxed text-white/85 md:text-lg"
                  data-reveal
                  style={revealDelay(index + 2)}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-12">
              <TextLink href={about.cta.href}>{about.cta.label}</TextLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
