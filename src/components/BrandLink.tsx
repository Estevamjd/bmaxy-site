"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { pagePath } from "@/lib/routes";
import type { Locale } from "@/content/site";

/**
 * =============================================================================
 *  A MARCA, SEMPRE CLICÁVEL
 * =============================================================================
 *
 *  Existe porque a marca aparecia em três lugares com três comportamentos
 *  diferentes — e um deles estava errado:
 *
 *    - header: <Link> com aria-label. Certo.
 *    - RODAPÉ: <Link> SEM nome acessível — o link tinha só o símbolo (que é
 *      aria-hidden) e a palavra "BMAXY", então o leitor de tela anunciava
 *      apenas "BMAXY, link", sem dizer para onde ia.
 *    - MENU MOBILE ABERTO: era um <span>. Não era link nenhum. Quem abria o
 *      menu e tocava no logo esperando voltar pra home não ia a lugar nenhum.
 *
 *  Agora é um componente só, usado nos três lugares. Regras:
 *
 *  1. DESTINO POR IDIOMA — pt vai para "/", en vai para "/en". Vem de
 *     `pagePath("home", locale)`, a mesma tabela do menu e do hreflang.
 *
 *  2. JÁ ESTOU NA HOME → não recarrega a rota: cancela a navegação, fecha o
 *     menu (se estiver aberto) e sobe suavemente até o topo. Um <Link> para a
 *     rota atual no App Router não rola nada sozinho — o clique parecia não
 *     fazer efeito, que é justamente a reclamação de "o logo não funciona".
 *     `scroll-behavior: smooth` já está no <html> (globals.css) e respeita
 *     prefers-reduced-motion, mas `window.scrollTo` ignora essa preferência
 *     por conta própria, então a checagem é feita aqui também.
 *
 *  3. ÁREA DE TOQUE — min-h-11 (44px) com margem negativa, para o alvo crescer
 *     sem empurrar o layout do header.
 *
 *  4. NOME ACESSÍVEL — sempre, nos três lugares: "BMAXY — Escrever, ensinar,
 *     transformar". O símbolo continua aria-hidden (é decorativo, o texto ao
 *     lado já diz o nome).
 * =========================================================================== */

export default function BrandLink({
  wordmark,
  tagline,
  locale,
  uid,
  onNavigate,
  className = "",
}: {
  /* Duas strings, e não o SiteContent inteiro: este é um Client Component, e
     tudo que ele recebe vai serializado no HTML de toda página. Ver a nota em
     `headerContent` (src/content/site.ts). */
  wordmark: string;
  tagline: string;
  locale: Locale;
  /** Sufixo dos ids do SVG — precisa ser único por instância na página. */
  uid: string;
  /** Chamado ao clicar; usado pelo menu mobile para se fechar. */
  onNavigate?: () => void;
  className?: string;
}) {
  const homeHref = pagePath("home", locale);
  const pathname = usePathname();
  const isHome = pathname === homeHref;

  return (
    <Link
      href={homeHref}
      aria-label={`${wordmark} — ${tagline}`}
      aria-current={isHome ? "page" : undefined}
      onClick={(event) => {
        onNavigate?.();
        if (!isHome) return;

        event.preventDefault();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
      className={`group -my-2 -ml-1 inline-flex min-h-11 shrink-0 items-center gap-3 px-1 py-2 ${className}`}
    >
      <BrandMark className="h-10 w-10" uid={uid} />
      <span className="display text-[1.3125rem] leading-none text-white transition-colors duration-300 group-hover:text-gold md:text-[1.5rem]">
        {wordmark}
      </span>
    </Link>
  );
}
