"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * =============================================================================
 *  REVELAÇÃO AO ROLAR
 * =============================================================================
 *
 *  Um IntersectionObserver por rota, montado no layout persistente. Os
 *  componentes de servidor só marcam `data-reveal` (e, opcionalmente,
 *  `--reveal-delay`) — não há wrapper nem client component por seção, o que
 *  mantém o JS enviado ao navegador praticamente nulo.
 *
 *  O CSS deixa `[data-reveal]` em `opacity: 0` e só devolve a opacidade quando
 *  o elemento ganha `data-revealed="true"`. Quem põe esse atributo é este
 *  arquivo. Sem JS, o `<noscript>` do AppShell devolve a opacidade — o
 *  conteúdo aparece inteiro, só sem animação.
 *
 *  O DEFEITO QUE ISTO CORRIGE
 *  --------------------------
 *  A versão anterior usava `useEffect(..., [])`. Como o componente vive no
 *  layout, esse efeito rodava UMA vez na primeira montagem e varria
 *  `[data-reveal]` só naquele instante.
 *
 *  Numa navegação client-side o App Router não remonta o layout: troca só o
 *  conteúdo. Os elementos da página nova entravam no DOM depois da varredura,
 *  nunca eram observados, e ficavam presos em `opacity: 0` — ocupando altura,
 *  o que produzia "a página só com a abertura e uma grande área vazia". Um
 *  F5 escondia o problema, porque aí o layout remontava.
 *
 *  POR QUE `usePathname` **E** `MutationObserver`, e não um dos dois
 *  ----------------------------------------------------------------
 *  Nenhum dos dois sozinho cobre tudo:
 *
 *    - Só `usePathname`: o efeito reroda a cada rota e pega o que já está no
 *      DOM naquele momento. Mas conteúdo que chega DEPOIS — streaming, Suspense
 *      resolvendo, qualquer render assíncrono — entra sem ninguém olhando, e o
 *      bug volta em versão mais difícil de enxergar.
 *
 *    - Só `MutationObserver`: cobre inserção tardia e troca de rota (página
 *      nova = nós novos). O que ele não resolve é a LIMPEZA: o
 *      IntersectionObserver segura referência forte a cada alvo observado, e
 *      os nós da página anterior — removidos do DOM, mas ainda não revelados —
 *      continuariam observados indefinidamente.
 *
 *  Juntos, cada um cobre o furo do outro: a chave `pathname` garante um
 *  observador novo por rota (o cleanup desconecta o antigo e solta todos os
 *  alvos de uma vez), e o MutationObserver garante que nada inserido depois
 *  fique de fora.
 *
 *  DETALHES QUE PARECEM PEQUENOS E NÃO SÃO
 *  ---------------------------------------
 *    - O seletor exclui `[data-revealed]`. É o que impede reanimar o que já
 *      apareceu quando a varredura roda de novo.
 *    - O MutationObserver é ligado ANTES da primeira varredura. Ao contrário,
 *      um nó inserido no meio da varredura escaparia dos dois.
 *    - `observe()` no mesmo elemento duas vezes é no-op por especificação,
 *      então varrer de novo é seguro e não duplica animação.
 * =========================================================================== */

/** Só o que ainda não apareceu — reanimar o que já está na tela seria pior. */
const PENDENTES = "[data-reveal]:not([data-revealed])";

export default function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const pendentes = () => document.querySelectorAll<HTMLElement>(PENDENTES);
    const revelar = (node: Element) => node.setAttribute("data-revealed", "true");

    /* Quem pediu menos movimento não recebe animação nenhuma: o conteúdo
       aparece direto, agora e conforme for chegando. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const revelarTudo = () => pendentes().forEach(revelar);
      const mutacoes = new MutationObserver(revelarTudo);
      mutacoes.observe(document.body, { childList: true, subtree: true });
      revelarTudo();
      return () => mutacoes.disconnect();
    }

    const aoEntrar = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          revelar(entry.target);
          aoEntrar.unobserve(entry.target);
        }
      },
      /* A margem negativa embaixo evita que o elemento acenda antes de estar
         de fato à vista; o threshold baixo garante que blocos altos, que nunca
         cabem inteiros na tela, também disparem. */
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );

    const varrer = () => pendentes().forEach((node) => aoEntrar.observe(node));

    /* O MutationObserver já agrupa mutações num callback só por checkpoint de
       microtask, então varrer direto aqui tem a granularidade certa. */
    const mutacoes = new MutationObserver(varrer);
    mutacoes.observe(document.body, { childList: true, subtree: true });
    varrer();

    return () => {
      mutacoes.disconnect();
      aoEntrar.disconnect();
    };
  }, [pathname]);

  return null;
}
