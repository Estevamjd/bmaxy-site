"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { alternatePath } from "@/lib/routes";
import type { Locale } from "@/content/site";

/**
 * Seletor PT / EN. O idioma atual é só texto (não é link para a própria
 * página); o outro idioma é o <Link>.
 *
 * O destino é a PÁGINA EQUIVALENTE, não a home: de `/livros/aaron-tucker` o
 * botão leva a `/en/books/aaron-tucker`, de `/sobre` leva a `/en/about`.
 * Antes ele mandava todo mundo para a home do outro idioma — fazia sentido
 * quando só a home era bilíngue, e virou perda de contexto quando as páginas
 * internas ganharam versão em inglês.
 *
 * Nas rotas da plataforma (`/entrar`, `/cadastro`, `/aluno`, `/admin`), que
 * ainda só existem em português, `alternatePath` cai na home do idioma de
 * destino — é o único destino honesto enquanto não houver tradução.
 */
export function LanguageSwitch({
  locale,
  switchLabel,
  className = "",
}: {
  locale: Locale;
  /** Nome acessível do link — descreve o DESTINO ("Ver em inglês"). */
  switchLabel: string;
  className?: string;
}) {
  const pathname = usePathname();
  const target: Locale = locale === "pt" ? "en" : "pt";
  const otherCode = target === "en" ? "EN" : "PT";
  const current = locale === "pt" ? "PT" : "EN";

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] ${className}`}
    >
      <span aria-current="true" className="text-gold">
        {current}
      </span>
      <span aria-hidden="true" className="text-white/30">
        /
      </span>
      <Link
        href={alternatePath(pathname, target)}
        aria-label={switchLabel}
        hrefLang={target === "en" ? "en-US" : "pt-BR"}
        className="text-white/70 transition-colors duration-300 hover:text-white"
      >
        {otherCode}
      </Link>
    </div>
  );
}
