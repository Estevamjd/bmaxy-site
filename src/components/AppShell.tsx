import type { ReactNode } from "react";
import { archivo, inter } from "@/app/fonts";
import DuotoneDefs from "@/components/DuotoneDefs";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import RevealObserver from "@/components/RevealObserver";
import StructuredData from "@/components/StructuredData";
import { headerContent, type Locale, type SiteContent } from "@/content/site";

/**
 * Casca de <html>/<body> compartilhada pelos dois root layouts (pt e en —
 * ver src/app/(pt)/layout.tsx e src/app/en/layout.tsx). Cada idioma tem seu
 * próprio root layout porque só o root layout pode definir `lang` no
 * <html>, mas o MARKUP em si — header, skip-link, footer, structured data —
 * não se duplica: os dois layouts só chamam este componente com o
 * `site`/`locale` certos.
 */
export default function AppShell({
  site,
  locale,
  children,
}: {
  site: SiteContent;
  locale: Locale;
  children: ReactNode;
}) {
  const htmlLang = locale === "en" ? "en-US" : "pt-BR";

  return (
    /**
     * `data-scroll-behavior="smooth"` não é decoração: o Next 15.5 avisa que
     * vai parar de desligar sozinho o `scroll-behavior: smooth` durante troca
     * de rota, e este atributo é como se declara que a página SABE disso e
     * quer o comportamento novo. Sem ele, quando a mudança chegar, cada
     * navegação entre páginas passaria a rolar animadamente até o topo em vez
     * de pular direto — feio e desnecessário.
     *
     * O `scroll-behavior: smooth` em si continua em globals.css: é o que faz
     * as âncoras da home (#numeros, #curso, #bastidores) e o clique na logo
     * dentro da própria home rolarem suavemente. Os dois convivem.
     */
    <html
      lang={htmlLang}
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${inter.variable}`}
    >
      {/* eslint-disable-next-line @next/next/no-head-element -- este <head>
          É o do root layout: a regra só reconhece o arquivo layout.tsx, e os
          dois root layouts (pt e en) só existem para chamar este componente. */}
      <head>
        {/* Sem JS o IntersectionObserver não roda; sem isto o conteúdo ficaria
            invisível. Precisa vir antes do CSS ser aplicado, daí o <head>. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1 !important;transform:none !important}`}</style>
        </noscript>
      </head>
      <body className="bg-void font-sans text-white antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-5 focus:z-[100] focus:rounded-[2px] focus:bg-gold focus:px-5 focus:py-3 focus:font-sans focus:text-xs focus:font-medium focus:uppercase focus:tracking-[0.16em] focus:text-void"
        >
          {site.a11y.skipToContent}
        </a>

        <DuotoneDefs />
        {/* Só a fatia que o Header renderiza: ele é Client Component, e o que
            entra aqui vai serializado no HTML de toda página. */}
        <Header site={headerContent(site)} locale={locale} />
        {/* tabIndex={-1} para o link "pular para o conteúdo" mover o foco de
            verdade — Safari não move sozinho para um alvo não focável. */}
        <main id="conteudo" tabIndex={-1}>
          {children}
        </main>
        <Footer site={site} locale={locale} />

        <RevealObserver />
        <StructuredData site={site} locale={locale} />
      </body>
    </html>
  );
}
