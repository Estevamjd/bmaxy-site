import type { MetadataRoute } from "next";
import { siteContent } from "@/content/site";

/**
 * =============================================================================
 *  ROBOTS.TXT
 * =============================================================================
 *
 *  O que fica de fora do índice, e por quê:
 *
 *    /aluno/**, /admin/**  — área logada. Já exigem sessão e a rota redireciona
 *                            antes de renderizar, então o rastreador nunca veria
 *                            conteúdo; bloquear evita uma fila de URLs que só
 *                            devolvem redirecionamento.
 *    /entrar, /cadastro,
 *    /recuperar-senha,
 *    /redefinir-senha      — formulários de sessão. Não trazem visita orgânica e
 *                            aparecer na busca só ajuda quem procura superfície
 *                            de ataque.
 *    /auth/callback        — rota de troca de código do Supabase. Recebe token
 *                            na query string; indexar seria arquivar segredo.
 *    /api/**               — não existe hoje, e é justamente por isso que entra:
 *                            o dia em que existir, já nasce fora do índice.
 *
 *  `robots.txt` NÃO é controle de acesso — é pedido, e só os rastreadores
 *  honestos obedecem. Quem protege essas rotas é `requireUser`/`requireAdmin`
 *  e a RLS. Isto aqui é higiene de índice.
 *
 *  As páginas públicas não precisam de `Allow` explícito: sem `Disallow` que
 *  as cubra, já são permitidas.
 * =========================================================================== */

const PRIVADAS = [
  "/aluno/",
  "/admin/",
  "/entrar",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/acesso-negado",
  "/auth/",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  const base = siteContent.pt.meta.url.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVADAS,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
