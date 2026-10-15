"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import BrandMark from "@/components/BrandMark";
import { LocaleSwitcher } from "@/components/platform/LocaleSwitcher";
import {
  platformContent,
  platformHomePath,
  type PlatformLocale,
  type PlatformShellLabels,
} from "@/content/platform";
import {
  IconBooks,
  IconChevronLeft,
  IconClose,
  IconExternal,
  IconHome,
  IconHelp,
  IconLogout,
  IconMenu,
  IconUsers,
  IconVideo,
  IconWrite,
} from "@/components/platform/icons";
import { logoutAction } from "@/lib/actions/auth";

/**
 * =============================================================================
 *  NAVEGAÇÃO DA PLATAFORMA — sidebar no desktop, drawer no celular
 * =============================================================================
 *
 *  Um componente só para as duas formas, porque são a MESMA navegação: manter
 *  duas listas em arquivos diferentes é como um item acaba existindo só no
 *  desktop.
 *
 *  DESKTOP: barra fixa à esquerda, recolhível para 4.5rem (só ícones). O
 *  estado fica em localStorage — quem recolhe quer continuar recolhido amanhã.
 *  Ao recolher, o rótulo vira `title` + `aria-label`, então o item continua
 *  identificável por teclado e leitor de tela.
 *
 *  CELULAR: barra superior com gatilho e um drawer que cobre a tela, com trava
 *  de foco, Escape, `inert` no conteúdo atrás e trava de rolagem — o mesmo
 *  cuidado do menu da landing.
 *
 *  ITEM ATIVO: marcado com `aria-current="page"` E com filete dourado à
 *  esquerda. Nunca só por cor.
 * =========================================================================== */

/**
 * O ícone viaja como NOME, não como componente.
 *
 * Os layouts que montam esta lista são Server Components, e uma função não
 * atravessa a fronteira RSC — passar `icon: IconHome` derruba a página inteira
 * com "Functions cannot be passed directly to Client Components". O build não
 * pega isso: é erro de serialização em tempo de execução.
 *
 * Então o servidor manda uma string e o mapa abaixo, que vive DENTRO do
 * componente cliente, resolve o desenho.
 */
export type PlatformNavIcon = "home" | "users" | "books" | "video" | "write" | "help";

const NAV_ICONS: Record<PlatformNavIcon, React.ComponentType<{ className?: string }>> = {
  home: IconHome,
  users: IconUsers,
  books: IconBooks,
  video: IconVideo,
  write: IconWrite,
  help: IconHelp,
};

export type PlatformNavItem = {
  href: string;
  label: string;
  icon: PlatformNavIcon;
  /** Combina também com sub-rotas (`/admin/alunos/123` marca "Alunos"). */
  matchPrefix?: boolean;
};

const COLLAPSE_KEY = "bmaxy:platform-nav-collapsed";

export function PlatformNav({
  areaLabel,
  homeHref,
  navItems,
  userName,
  userEmail,
  locale = "pt",
  labels,
}: {
  areaLabel: string;
  homeHref: string;
  navItems: PlatformNavItem[];
  userName: string;
  userEmail: string;
  locale?: PlatformLocale;
  labels?: PlatformShellLabels;
}) {
  const copy = labels ?? platformContent[locale].shell;
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  /* Lê a preferência depois da montagem: o servidor não conhece localStorage, e
     ler durante o render causaria divergência de hidratação. */
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  /* A sidebar é `fixed`; quem reserva o espaço dela é o padding do conteúdo, em
     globals.css. Esse padding não pode ficar preso num valor só — com a barra
     expandida ela cobriria o começo de cada linha. Marcar o <html> é o que
     permite o CSS reagir sem tornar o shell inteiro Client Component. */
  useEffect(() => {
    document.documentElement.dataset.navCollapsed = collapsed ? "1" : "0";
    return () => {
      delete document.documentElement.dataset.navCollapsed;
    };
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  /* Trocar de rota fecha o drawer. */
  useEffect(() => setDrawerOpen(false), [pathname]);

  /* Se a janela crescer com o drawer aberto (rotação de tablet), ele some por
     CSS mas o estado continuaria true — e a trava de rolagem ficaria presa. */
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const backdrop = document.getElementById("plataforma-conteudo");
    backdrop?.setAttribute("inert", "");

    drawerRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const panel = drawerRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
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
      backdrop?.removeAttribute("inert");
      trigger?.focus();
    };
  }, [drawerOpen]);

  const isActive = (item: PlatformNavItem) =>
    item.matchPrefix
      ? pathname === item.href || pathname.startsWith(`${item.href}/`)
      : pathname === item.href;

  /* ------------------------------- pedaços ------------------------------- */

  const brand = (showText: boolean) => (
    <Link
      href={homeHref}
      className="flex min-h-11 items-center gap-2.5 rounded-[3px] px-2 transition-colors duration-200 hover:bg-panel-hi"
      aria-label={`BMaxy — ${areaLabel}`}
    >
      <BrandMark className="h-8 w-8 shrink-0" uid="plat" />
      {showText ? (
        <span className="min-w-0">
          <span className="display block text-[0.9375rem] leading-none text-warm-white">
            BMAXY
          </span>
          <span className="mt-1 block truncate font-sans text-[0.6875rem] uppercase tracking-[0.14em] text-gold">
            {areaLabel}
          </span>
        </span>
      ) : null}
    </Link>
  );

  const navList = (showText: boolean, onNavigate?: () => void) => (
    <nav aria-label={areaLabel} className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = isActive(item);
        const Icon = NAV_ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={showText ? undefined : item.label}
            aria-label={showText ? undefined : item.label}
            className={`relative flex min-h-11 items-center gap-3 rounded-[3px] px-3 font-sans text-sm transition-colors duration-200 ${
              active
                ? "bg-panel-hi text-warm-white"
                : "text-ash hover:bg-panel-hi hover:text-warm-white"
            } ${showText ? "" : "justify-center px-0"}`}
          >
            {/* Filete dourado: o item ativo não depende só de cor de texto. */}
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold"
              />
            ) : null}
            <Icon className="h-5 w-5 shrink-0" />
            {showText ? <span className="truncate">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  const account = (showText: boolean) => (
    <div className="border-t border-panel-line pt-4">
      {showText ? (
        <>
          <div className="px-3 pb-3">
            <p className="truncate font-sans text-sm text-warm-white">{userName}</p>
            <p className="truncate font-sans text-xs text-ash">{userEmail}</p>
          </div>
          <div className="px-3">
            <LocaleSwitcher locale={locale} labels={platformContent[locale].localeSwitch} />
          </div>
        </>
      ) : null}

      <Link
        href={platformHomePath(locale)}
        className={`flex min-h-11 items-center gap-3 rounded-[3px] px-3 font-sans text-sm text-ash transition-colors duration-200 hover:bg-panel-hi hover:text-warm-white ${
          showText ? "" : "justify-center px-0"
        }`}
        title={showText ? undefined : copy.backToSite}
        aria-label={showText ? undefined : copy.backToSite}
      >
        <IconExternal className="h-5 w-5 shrink-0" />
        {showText ? <span>{copy.backToSite}</span> : null}
      </Link>

      <form action={logoutAction}>
        <button
          type="submit"
          className={`flex min-h-11 w-full items-center gap-3 rounded-[3px] px-3 font-sans text-sm text-ash transition-colors duration-200 hover:bg-panel-hi hover:text-warm-white ${
            showText ? "" : "justify-center px-0"
          }`}
          title={showText ? undefined : copy.logOut}
          aria-label={showText ? undefined : copy.logOut}
        >
          <IconLogout className="h-5 w-5 shrink-0" />
          {showText ? <span>{copy.logOut}</span> : null}
        </button>
      </form>
    </div>
  );

  /* ------------------------------- render -------------------------------- */

  return (
    <>
      {/* ============================ DESKTOP ============================ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-panel-line bg-panel px-3 py-4 transition-[width] duration-200 ease-out-expo lg:flex ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        {brand(!collapsed)}

        <div className="mt-6 flex-1 overflow-y-auto">{navList(!collapsed)}</div>

        <div className="mt-4">
          {account(!collapsed)}

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? copy.expandSidebar : copy.collapseSidebar}
            className={`mt-2 flex min-h-11 w-full items-center gap-3 rounded-[3px] px-3 font-sans text-xs text-ash transition-colors duration-200 hover:bg-panel-hi hover:text-warm-white ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <IconChevronLeft
              className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                collapsed ? "rotate-180" : ""
              }`}
            />
            {!collapsed ? <span>{copy.collapse}</span> : null}
          </button>
        </div>
      </aside>

      {/* ============================= CELULAR ============================ */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-panel-line bg-panel/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href={homeHref} className="flex items-center gap-2.5" aria-label={`BMaxy — ${areaLabel}`}>
          <BrandMark className="h-7 w-7" uid="platm" />
          <span className="font-sans text-[0.6875rem] uppercase tracking-[0.14em] text-gold">
            {areaLabel}
          </span>
        </Link>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-label={copy.openMenu}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-[3px] text-warm-white"
        >
          <IconMenu className="h-6 w-6" />
        </button>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="fade-in absolute inset-0 bg-void/80 backdrop-blur-sm" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={areaLabel}
            tabIndex={-1}
            className="drawer-panel relative flex h-full w-[17.5rem] max-w-[85vw] flex-col border-r border-panel-line bg-panel px-3 py-4 focus:outline-none"
          >
            <div className="flex items-center justify-between">
              {brand(true)}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={copy.closeMenu}
                className="flex h-11 w-11 items-center justify-center rounded-[3px] text-warm-white"
              >
                <IconClose className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-6 flex-1 overflow-y-auto">
              {navList(true, () => setDrawerOpen(false))}
            </div>

            <div className="mt-4">{account(true)}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
