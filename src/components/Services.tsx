import Link from "next/link";
import { SectionEyebrow } from "@/components/ui";
import type { SiteContent } from "@/content/site";
import { revealDelay } from "@/lib/reveal";

/**
 * Quatro linhas empilhadas ocupando a largura inteira da tela.
 * O fundo do hover sangra de borda a borda (o <Link> é o bloco full-bleed),
 * enquanto o conteúdo continua alinhado ao container de 1440px.
 *
 * Mobile: número + seta na primeira linha, título e descrição embaixo.
 * Desktop: tudo numa linha só, em grade de 12 colunas — 2 / 5 / 4 / 1.
 * A reordenação é feita com `order`, sem duplicar nada no DOM.
 */
export default function Services({ site }: { site: SiteContent }) {
  const { services } = site;

  return (
    <section id="servicos" className="section-y bg-void">
      <div className="container-site">
        <SectionEyebrow index={services.index} label={services.label} />
        <h2 className="display t-section mt-6 text-white">{services.title}</h2>
      </div>

      <div className="mt-14 md:mt-20">
        {services.items.map((item, index) => (
          <Link
            key={item.number}
            href={item.href}
            className="group relative block border-t border-line transition-colors duration-500 ease-out-expo hover:bg-deep-surface focus-visible:bg-deep-surface [&:last-child]:border-b"
            data-reveal
            style={revealDelay(index)}
          >
            {/* filete dourado que cresce da esquerda sobre a divisória */}
            <span
              aria-hidden="true"
              className="absolute inset-x-0 -top-px h-px origin-left scale-x-0 bg-gold transition-transform duration-[900ms] ease-out-expo group-hover:scale-x-100 group-focus-visible:scale-x-100"
            />

            <div className="container-site">
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-4 py-9 md:py-11 lg:grid-cols-12 lg:gap-x-8 lg:py-14">
                <span className="label-eyebrow order-1 text-ash transition-colors duration-500 group-hover:text-gold lg:order-1 lg:col-span-2">
                  {item.number}
                </span>

                <span
                  aria-hidden="true"
                  className="order-2 justify-self-end text-white/35 transition-colors duration-500 group-hover:text-gold lg:order-4 lg:col-span-1"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    focusable="false"
                    className="h-6 w-6 transition-transform duration-500 ease-out-expo group-hover:translate-x-1.5 md:h-7 md:w-7"
                  >
                    <path d="M4 12h16" />
                    <path d="M14 6l6 6-6 6" />
                  </svg>
                </span>

                <h3 className="order-3 col-span-2 display t-service text-white transition-transform duration-500 ease-out-expo group-hover:translate-x-3 lg:order-2 lg:col-span-5">
                  {item.title}
                </h3>

                <p className="order-4 col-span-2 max-w-[46ch] text-[0.9375rem] leading-relaxed text-ash md:text-base lg:order-3 lg:col-span-4">
                  {item.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
