import type { Metadata, Viewport } from "next";
import { archivo, inter } from "@/app/fonts";
import { getPlatformContent } from "@/lib/i18n/locale";
import "../globals.css";

/**
 * Root layout da PLATAFORMA (login, recuperação de senha, área do aluno,
 * painel administrativo) — distinto do root layout da landing ((pt)/ e
 * en/). Só o <html>/<body> vive aqui; cada área (auth, /aluno, /admin)
 * desenha seu próprio topo/menu lateral, então este layout fica sem chrome
 * visível nenhum.
 *
 * O idioma da plataforma vem do perfil autenticado; para visitantes ainda
 * sem sessão, o cookie de preferência mantém auth e landing consistentes.
 *
 * force-dynamic pra toda a árvore: são páginas de sessão (login, aluno,
 * admin) — nunca deveriam ser pré-renderizadas estaticamente de qualquer
 * forma, e sem isso o `next build` tenta prerenderizar /aluno e /admin sem
 * requisição real nenhuma, o que quebra o build quando o Supabase ainda
 * não está configurado (as DAL chamam createClient(), que lança sem as
 * variáveis de ambiente).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPlatformContent();
  return {
    title: { default: "BMaxy", template: `%s — BMaxy` },
    description:
      content.htmlLang === "en-US"
        ? "Secure access to the BMAXY platform."
        : "Acesso seguro à plataforma BMAXY.",
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#07082A",
  colorScheme: "dark",
};

export default async function AppRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const content = await getPlatformContent();

  return (
    /* Mesmo motivo do layout público — ver a nota em AppShell.tsx. A regra
       `scroll-behavior: smooth` vem do mesmo globals.css, então este root
       layout precisa declarar a mesma intenção. */
    <html
      lang={content.htmlLang}
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${inter.variable}`}
    >
      <body className="min-h-screen bg-void font-sans text-white antialiased">
        {children}
      </body>
    </html>
  );
}
