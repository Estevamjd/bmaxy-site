"use client";

import { useState } from "react";
import { Pause, Play } from "@/components/icons";
import type { SiteContent } from "@/content/site";

/**
 * Faixa horizontal infinita, animada 100% em CSS.
 * A trilha tem duas metades idênticas e desliza -50%: quando a animação
 * reinicia, o pixel que está na tela é exatamente o mesmo, então não há emenda.
 * Cada metade repete a lista três vezes para passar de 100vw mesmo em 1920px.
 *
 * O botão de pausa não é enfeite: uma animação infinita com mais de 5 segundos
 * precisa de um controle operável por teclado (WCAG 2.2.2). O `:hover` do CSS
 * resolve só para quem usa mouse.
 */

const REPEATS_PER_HALF = 3;

function Half({ items, separator }: { items: string[]; separator: string }) {
  return (
    <div className="flex shrink-0 items-center">
      {Array.from({ length: REPEATS_PER_HALF }).flatMap((_, repeat) =>
        items.map((item) => (
          <span
            key={`${repeat}-${item}`}
            className="display t-marquee flex shrink-0 items-center whitespace-nowrap text-void"
          >
            <span className="px-6 md:px-8">{item}</span>
            <span className="opacity-45">{separator}</span>
          </span>
        )),
      )}
    </div>
  );
}

export default function Marquee({ site }: { site: SiteContent }) {
  const [paused, setPaused] = useState(false);

  return (
    <div className="marquee-host on-gold relative overflow-hidden bg-gold py-4 md:py-5">
      {/* A lista lida por leitor de tela vive uma vez só, fora da animação. */}
      <p className="sr-only">{site.marquee.items.join(", ")}</p>

      <div
        className="marquee"
        aria-hidden="true"
        /* Só aplicamos o inline style quando pausado: um `running` inline
           venceria a pausa por :hover, que é declarada no CSS. */
        style={paused ? { animationPlayState: "paused" } : undefined}
      >
        <Half items={site.marquee.items} separator={site.marquee.separator} />
        <Half items={site.marquee.items} separator={site.marquee.separator} />
      </div>

      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        aria-label={paused ? site.marquee.playLabel : site.marquee.pauseLabel}
        /* O anel de foco padrão fica 3px PARA FORA da caixa, e este botão
           encosta em três bordas do host, que é overflow-hidden — o anel seria
           recortado. Aqui ele é desenhado para dentro. */
        className="absolute right-0 top-0 flex h-full w-12 items-center justify-center border-l border-void/30 bg-gold text-void transition-colors duration-300 hover:bg-gold-hi focus-visible:-outline-offset-4 md:w-14"
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </button>
    </div>
  );
}
