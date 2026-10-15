import { Plus } from "@/components/icons";
import { SectionEyebrow } from "@/components/ui";
import type { SiteContent } from "@/content/site";
import { revealDelay } from "@/lib/reveal";

/**
 * Quatro métricas, todas verificáveis — ver a nota em `stats` dentro de
 * site.ts antes de acrescentar qualquer número aqui.
 *
 * Layout: 2 colunas até 768px, 4 acima. As divisórias (filete em cima de toda
 * célula, filete vertical entre colunas) vêm da utility `stats-grid` em
 * globals.css, que é quem sabe qual célula abre cada linha em cada
 * breakpoint.
 */
export default function Stats({ site }: { site: SiteContent }) {
  const { stats } = site;

  return (
    /* id: as outras seções da home já têm o seu (#servicos, #livros, #curso,
       #sobre) e são iguais nos dois idiomas — este segue a mesma convenção. */
    <section id="numeros" className="section-y bg-deep-surface">
      <div className="container-site">
        {/* Aqui a etiqueta é o único título da seção, então ela É o h2 — senão
            "Em números" não existiria na navegação por headings. */}
        <SectionEyebrow as="h2" label={stats.label} tone="deep" />

        <dl className="stats-grid mt-12 grid gap-y-12 md:mt-16 md:gap-y-0">
          {stats.items.map((item, index) => (
            <div
              key={item.label}
              className="relative flex flex-col-reverse pt-8 md:pt-10"
              data-reveal
              /* Cascata curta: os quatro números entram em sequência, não de
                 uma vez, mas sem virar espetáculo — 70ms entre eles. */
              style={revealDelay(index, 70)}
            >
              {/* Centrado no cruzamento dos dois filetes, como os marcadores
                  de canto do resto do site (ver PlusCorners em ui.tsx). */}
              <Plus className="absolute -left-[7px] -top-[7px] h-3.5 w-3.5 text-gold" />
              {/* dt antes de dd no DOM (o HTML exige); a ordem visual — número
                  grande em cima, legenda embaixo — vem do flex-col-reverse. */}
              <dt className="label-eyebrow mt-4 text-white/70">{item.label}</dt>
              <dd className="display t-stat text-white">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
