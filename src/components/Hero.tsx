import Image from "next/image";
import { Plus } from "@/components/icons";
import { ButtonGhost, ButtonPrimary } from "@/components/ui";
import type { SiteContent } from "@/content/site";
import { revealDelay } from "@/lib/reveal";

export default function Hero({ site }: { site: SiteContent }) {
  const { hero, brand } = site;

  return (
    <section className="relative bg-void">
      <div className="container-site flex min-h-svh flex-col justify-end pb-12 pt-28 md:pt-32 lg:pb-16">
        <div className="grid grid-cols-1 gap-y-12 lg:grid-cols-12 lg:items-end lg:gap-x-12">
          {/* Coluna do texto */}
          <div className="lg:col-span-8">
            <p
              className="label-eyebrow flex items-center gap-3 text-ash"
              data-reveal
              style={revealDelay(0)}
            >
              <Plus className="h-3 w-3 text-gold" />
              {hero.label}
            </p>

            <h1 className="display t-hero mt-7 text-white md:mt-9">
              {hero.titleLines.map((line, index) => (
                <span
                  key={line}
                  className="block"
                  data-reveal
                  style={revealDelay(index + 1)}
                >
                  {line}
                </span>
              ))}
            </h1>

            <p
              className="measure mt-8 text-[1.0625rem] leading-relaxed text-ash md:mt-10 md:text-lg"
              data-reveal
              style={revealDelay(4)}
            >
              {hero.paragraph}
            </p>

            <div
              className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center md:mt-12"
              data-reveal
              style={revealDelay(5)}
            >
              <ButtonPrimary href={hero.primaryCta.href}>
                {hero.primaryCta.label}
              </ButtonPrimary>

              <ButtonGhost href={hero.secondaryCta.href}>
                {hero.secondaryCta.label}
              </ButtonGhost>
            </div>
          </div>

          {/* Coluna da fotografia */}
          <div
            className="relative lg:col-span-4 lg:flex lg:justify-end"
            data-reveal
            style={revealDelay(3)}
          >
            <span
              aria-hidden="true"
              className="absolute -left-6 top-0 hidden h-full w-px bg-gold lg:block"
            />

            <Plus className="absolute -left-[7px] -top-[7px] hidden h-3.5 w-3.5 text-gold lg:block" />
            {/* Sem .duotone aqui: é foto real do cliente, e o filtro
                --void/--violet escurece demais o rosto, sem legibilidade
                natural. Ver nota em globals.css / README. */}
            <div className="relative aspect-[4/5] w-full overflow-hidden lg:aspect-[3/4]">
              {/* Esta é a ÚNICA imagem prioritária da home, e é medida, não
                  chutada: em 1440x900, 768x1024 e 390x844 ela é o elemento de
                  LCP e nasce dentro da dobra (topo em 227px, 756px e 682px).

                  `priority` sozinho faz o Next emitir o <link rel="preload">,
                  mas NÃO escreve fetchpriority no <img> — conferido no HTML
                  servido. Sem o atributo, o navegador trata a busca da maior
                  imagem da página com prioridade "auto" e ela concorre com o
                  resto do carregamento. Daí o fetchPriority explícito.

                  Todas as outras imagens do site continuam sem priority e com
                  loading="lazy" — inclusive a de /people/rodrigo-hero.png que
                  reaparece na seção 05, lá embaixo. Marcar tudo como
                  prioritário é o mesmo que não marcar nada. */}
              <Image
                src={hero.portrait.src}
                alt={hero.portrait.alt}
                width={hero.portrait.width}
                height={hero.portrait.height}
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 34vw, 100vw"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Indicador de rolagem */}
        <div
          className="mt-14 flex items-center gap-4 lg:mt-16"
          data-reveal
          style={revealDelay(6)}
        >
          <span className="label-eyebrow text-ash">{hero.scrollHint}</span>

          <span
            aria-hidden="true"
            className="scroll-hint-line h-8 w-px bg-gold"
          />

          <span className="label-eyebrow ml-auto hidden text-ash md:inline">
            {brand.taglineInline}
          </span>
        </div>
      </div>
    </section>
  );
}