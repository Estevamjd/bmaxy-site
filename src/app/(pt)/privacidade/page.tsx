import type { Metadata } from "next";
import LegalPage from "@/components/pages/LegalPage";
import { legalContent } from "@/content/legal";
import { siteContent } from "@/content/site";
import { buildPageMetadata } from "@/lib/metadata";

/**
 * Minuta técnica inicial — precisa de aprovação do cliente e, idealmente, de
 * revisão jurídica antes do lançamento comercial. Ver docs/LEGAL.md.
 *
 * Deixou de ser StubPage, então é INDEXÁVEL: sem `robots` aqui valem os
 * `index: true, follow: true` do root layout, igual às outras páginas reais.
 *
 * O texto está em src/content/legal.ts e o desenho em LegalPage.tsx.
 */

const site = siteContent.pt;

export const metadata: Metadata = buildPageMetadata({
  site,
  locale: "pt",
  key: "privacy",
  title: legalContent.pt.privacy.meta.title,
  description: legalContent.pt.privacy.meta.description,
});

export default function Page() {
  return <LegalPage site={site} locale="pt" doc={legalContent.pt.privacy} />;
}
