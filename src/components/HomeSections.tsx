import About from "@/components/About";
import BehindThePages from "@/components/BehindThePages";
import Books from "@/components/Books";
import type { LivroPublico } from "@/lib/dal/catalog";
import Course from "@/components/Course";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import Paths from "@/components/Paths";
import Services from "@/components/Services";
import Stats from "@/components/Stats";
import type { SiteContent } from "@/content/site";

/**
 * A composição da home, parametrizada por `site` — a mesma árvore de seções
 * serve `/` (pt) e `/en`, cada rota só escolhe qual SiteContent passar.
 * Nenhuma seção é duplicada por idioma; só o conteúdo muda.
 *
 * Testimonials e Newsletter não entram aqui de propósito:
 * - Testimonials: removida do tipo SiteContent e do componente — não há
 *   depoimento real e autorizado ainda. Nada de nome/fala fictícia "só pra
 *   preencher". Ver nota no tipo `SiteContent` em site.ts.
 * - Newsletter: o formulário nunca enviou nada de verdade (sem backend,
 *   sem serviço de e-mail ligado) — prometer "material gratuito" que não
 *   chega é a mesma categoria de problema que os depoimentos fictícios.
 *   Componente e conteúdo continuam no repositório; religar quando houver
 *   um serviço de e-mail de verdade por trás do formulário.
 */
export default function HomeSections({
  site,
  livros,
}: {
  site: SiteContent;
  /** A seção de livros da home lê do banco, igual ao catálogo. */
  livros: LivroPublico[];
}) {
  return (
    <>
      <Hero site={site} />
      <Paths site={site} />
      <Marquee site={site} />
      <Stats site={site} />
      <Services site={site} />
      <Books site={site} livros={livros} />
      <Course site={site} />
      <About site={site} />
      <BehindThePages site={site} />
    </>
  );
}
