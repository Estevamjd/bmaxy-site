import type { Metadata } from "next";
import { PlatformShell, type PlatformNavItem } from "@/components/platform/PlatformShell";
import { requireStudent } from "@/lib/auth/session";
import { listMyCourses } from "@/lib/dal/student";
import { studentContent } from "@/content/student";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireStudent("/aluno");
  const area = studentContent[auth.locale].meta.area;
  return { title: { default: area, template: `%s — ${area}` } };
}

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireStudent("/aluno");

  /**
   * Os cursos do aluno entram no menu lateral. Com um curso só isso parece
   * exagero; com três, "Início" sozinho obrigaria a voltar ao painel toda vez
   * para trocar de curso. A lista já vem filtrada por RLS — o que aparece aqui
   * é exatamente o que ele pode abrir.
   */
  const courses = await listMyCourses();
  const copy = studentContent[auth.locale];

  const navItems: PlatformNavItem[] = [
    { href: "/aluno", label: copy.shell.nav.dashboard, icon: "home" },
    {
      href: courses[0]
        ? `/aluno/curso/${courses[0].slug}`
        : auth.locale === "en"
          ? "/en/course"
          : "/curso",
      label: copy.shell.nav.course,
      icon: "books",
      matchPrefix: Boolean(courses[0]),
    },
    { href: "/aluno/meu-livro", label: copy.shell.nav.studio, icon: "write" },
    { href: "/aluno/biblioteca", label: copy.shell.nav.library, icon: "books" },
    { href: "/aluno/ajuda", label: copy.shell.nav.help, icon: "help" },
  ];

  return (
    <PlatformShell
      areaLabel={copy.shell.area}
      homeHref="/aluno"
      navItems={navItems}
      userName={auth.fullName || copy.shell.fallbackName}
      userEmail={auth.email ?? ""}
      locale={auth.locale}
    >
      {children}
    </PlatformShell>
  );
}
