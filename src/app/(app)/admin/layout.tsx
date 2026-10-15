import type { Metadata } from "next";
import { PlatformShell, type PlatformNavItem } from "@/components/platform/PlatformShell";
import { adminContent } from "@/content/admin";
import { platformContent } from "@/content/platform";
import { requireAdmin } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireAdmin("/admin");
  const copy = adminContent[auth.locale].meta;
  return { title: { default: copy.layoutDefault, template: copy.layoutTemplate } };
}

/**
 * Três destinos, e só. "Conteúdo" não vira item separado de propósito: um
 * módulo ou uma aula não existem fora de um curso, então o caminho honesto é
 * Cursos → curso → conteúdo. Um item "Conteúdo" no topo prometeria uma
 * listagem global que não existe.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAdmin("/admin");
  const copy = adminContent[auth.locale];
  const navItems: PlatformNavItem[] = [
    { href: "/admin", label: copy.nav.dashboard, icon: "home" },
    { href: "/admin/alunos", label: copy.nav.students, icon: "users", matchPrefix: true },
    { href: "/admin/cursos", label: copy.nav.courses, icon: "books", matchPrefix: true },
    { href: "/admin/livros", label: copy.nav.books, icon: "books", matchPrefix: true },
  ];

  return (
    <PlatformShell
      areaLabel={copy.nav.area}
      homeHref="/admin"
      navItems={navItems}
      userName={auth.fullName || copy.nav.adminFallback}
      userEmail={auth.email ?? ""}
      locale={auth.locale}
      labels={platformContent[auth.locale].shell}
    >
      {children}
    </PlatformShell>
  );
}
