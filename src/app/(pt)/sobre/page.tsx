import type { Metadata } from "next";
import AboutPage from "@/components/pages/AboutPage";
import { siteContent } from "@/content/site";
import { buildPageMetadata } from "@/lib/metadata";

const site = siteContent.pt;

export const metadata: Metadata = buildPageMetadata({
  site,
  locale: "pt",
  key: "about",
  title: "Sobre",
  description: site.pages.about.lead,
});

export default function Page() {
  return <AboutPage site={site} locale="pt" />;
}
