"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import BrandLink from "@/components/BrandLink";
import { Close, MenuBars } from "@/components/icons";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { pageKeyForPath } from "@/lib/routes";
import type { HeaderContent, Locale } from "@/content/site";

export default function Header({
  site,
  locale,
}: {
  /* Fatia estreita, não o SiteContent inteiro: este é um Client Component e
     tudo que ele recebe é serializado no HTML de TODA página. Ver a nota em
     `headerContent` (src/content/site.ts). */
  site: HeaderContent;
  locale: Locale;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  /* Transparente sobre o hero, --void com blur assim que a página anda. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Fecha o painel ao trocar de rota. */
  useEffect(() => setOpen(false), [pathname]);

  /* O painel é lg:hidden. Se a janela cruzar 1024px com ele aberto (rotação de
     tablet), ele some por CSS mas o estado continua true — e a trava de scroll
     ficaria presa sem nada visível para desfazê-la. */
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  /* Trava o scroll do documento e devolve o foco ao botão ao fechar. */
  useEffect(() => {
    if (!open) return;

    // Capturado agora: no cleanup o ref já pode apontar para outro nó.
    const toggle = toggleRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // O painel cobre a tela, mas header, main e footer continuam no DOM e
    // continuam alcançáveis pelo modo de leitura do leitor de tela. `inert`
    // tira os três da árvore de acessibilidade enquanto o menu está aberto.
    const backdrops = [
      headerRef.current,
      document.getElementById("conteudo"),
      document.querySelector("footer"),
    ].filter((node): node is HTMLElement => node instanceof HTMLElement);
    backdrops.forEach((node) => node.setAttribute("inert", ""));

    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      // Trava o Tab dentro do painel: sem isto o foco atravessa para o header
      // e para a página atrás, que continuam no DOM e continuam focáveis.
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);

      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      // O inert sai antes do focus(): elemento inerte não recebe foco.
      backdrops.forEach((node) => node.removeAttribute("inert"));
      toggle?.focus();
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  /* Qual item do menu corresponde à página atual. Compara por CHAVE de página
     (`about`, `books`, …) e não por href literal: assim `/livros/aaron-tucker`
     continua marcando "Livros", e o mesmo cálculo serve para pt e en. */
  const currentKey = pageKeyForPath(pathname);
  const isCurrent = (href: string) => {
    const key = pageKeyForPath(href);
    return key !== null && key === currentKey;
  };

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed inset-x-0 top-0 z-50 border-b border-transparent transition-[background-color,backdrop-filter,border-color] duration-500 ${
          scrolled && !open ? "header-scrolled" : ""
        }`}
      >
        <div className="container-site flex h-[72px] items-center justify-between gap-6 md:h-24">
          <BrandLink wordmark={site.wordmark} tagline={site.tagline} locale={locale} uid="hdr" />

          <nav
            aria-label={site.mainNavLabel}
            className="hidden items-center gap-9 lg:flex"
          >
            {site.nav.map((item) => {
              const current = isCurrent(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  /* O item atual não depende só da cor: ganha um filete
                     dourado permanente embaixo (o mesmo traço que o hover
                     desenha), para não ficar dependendo de contraste de cor. */
                  className={`font-sans text-xs font-medium uppercase tracking-[0.16em] transition-colors duration-300 ${
                    current
                      ? "border-b border-gold pb-1 text-gold"
                      : "link-underline text-white/80 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            <LanguageSwitch
              locale={locale}
              switchLabel={site.switchToLanguage}
              className="hidden md:inline-flex mr-1"
            />

            {/* O curso é fechado por login; a porta precisa estar sempre à mão. */}
            <Link
              href={site.studentArea.href}
              className="hidden min-h-11 items-center px-3 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-white/80 transition-colors duration-300 hover:text-gold md:inline-flex"
            >
              {site.studentAreaShort}
            </Link>

            <Link
              href={site.headerCta.href}
              className="inline-flex min-h-11 items-center rounded-[2px] bg-gold px-4 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-void transition-colors duration-300 hover:bg-gold-hi sm:px-5"
            >
              {/* Rótulo curto no celular: o cheio empurraria o menu para fora. */}
              <span className="sm:hidden">{site.headerCtaShort}</span>
              <span className="hidden sm:inline">{site.headerCta.label}</span>
            </Link>

            {/* Sem aria-controls: o painel só existe no DOM quando aberto, e um
                IDREF órfão não descreve relação nenhuma. aria-expanded sozinho
                já é o padrão de disclosure. */}
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? site.closeMenu : site.openMenu}
              aria-expanded={open}
              className="-mr-2 flex h-11 w-11 items-center justify-center text-white lg:hidden"
            >
              <MenuBars className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Painel de tela cheia — mobile e tablet */}
      {open ? (
        <div
          ref={panelRef}
          id="menu-mobile"
          role="dialog"
          aria-modal="true"
          aria-label={site.mainNavLabel}
          className="menu-panel fixed inset-0 z-[60] flex flex-col bg-void lg:hidden"
        >
          <div className="container-site flex h-[72px] shrink-0 items-center justify-between md:h-24">
            {/* Era um <span> — não levava a lugar nenhum. Agora é o mesmo link
                do header, e fecha o painel ao ser usado. */}
            <BrandLink
              wordmark={site.wordmark}
              tagline={site.tagline}
              locale={locale}
              uid="menu"
              onNavigate={close}
            />
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label={site.closeMenu}
              className="-mr-2 flex h-11 w-11 items-center justify-center text-white"
            >
              <Close className="h-6 w-6" />
            </button>
          </div>

          <nav
            aria-label={site.mainNavLabel}
            className="container-site flex flex-1 flex-col justify-center overflow-y-auto py-10"
          >
            <ul>
              {site.nav.map((item, index) => {
                const current = isCurrent(item.href);
                return (
                  <li
                    key={item.label}
                    className="menu-item border-t border-line last:border-b"
                    style={{ animationDelay: `${60 + index * 55}ms` }}
                  >
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={current ? "page" : undefined}
                      className="group flex items-baseline gap-4 py-4"
                    >
                      <span className="label-eyebrow shrink-0 text-gold">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`display t-menu transition-colors duration-300 group-hover:text-gold ${
                          current ? "text-gold" : "text-white"
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div
            className="menu-item container-site shrink-0 pb-10"
            style={{ animationDelay: `${60 + site.nav.length * 55}ms` }}
          >
            <Link
              href={site.headerCta.href}
              onClick={close}
              className="block rounded-[2px] bg-gold px-6 py-4 text-center font-sans text-xs font-medium uppercase tracking-[0.16em] text-void"
            >
              {site.headerCta.label}
            </Link>
            {/* Criar conta e Entrar lado a lado: são as duas portas da
                plataforma e no celular ninguém acha uma sem a outra. */}
            <div className="mt-4 flex items-center justify-center gap-6">
              <Link
                href={site.signupLink.href}
                onClick={close}
                className="flex min-h-11 items-center font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold transition-colors duration-300 hover:text-gold-hi"
              >
                <span className="link-underline">{site.signupLink.label}</span>
              </Link>
              <span aria-hidden="true" className="text-white/30">
                /
              </span>
              <Link
                href={site.studentArea.href}
                onClick={close}
                className="flex min-h-11 items-center font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-white/80 transition-colors duration-300 hover:text-gold"
              >
                {site.studentArea.label}
              </Link>
            </div>

            <LanguageSwitch
              locale={locale}
              switchLabel={site.switchToLanguage}
              className="mt-6 flex justify-center"
            />

            <p className="label-eyebrow mt-4 text-center text-ash">
              {site.taglineInline}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
