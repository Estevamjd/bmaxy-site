import type { Metadata } from "next";
import CoursePage from "@/components/pages/CoursePage";
import { siteContent } from "@/content/site";
import { buildPageMetadata } from "@/lib/metadata";

const site = siteContent.pt;

export const metadata: Metadata = buildPageMetadata({
  site,
  locale: "pt",
  key: "course",
  title: "Curso Seu Livro",
  description: site.pages.course.lead,
});

export default function Page() {
  return <CoursePage site={site} locale="pt" />;
}
