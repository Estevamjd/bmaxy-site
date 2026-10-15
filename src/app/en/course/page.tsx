import type { Metadata } from "next";
import CoursePage from "@/components/pages/CoursePage";
import { siteContent } from "@/content/site";
import { buildPageMetadata } from "@/lib/metadata";

const site = siteContent.en;

export const metadata: Metadata = buildPageMetadata({
  site,
  locale: "en",
  key: "course",
  title: "Write Your Book — Book Writing Course",
  description: site.pages.course.lead,
});

export default function Page() {
  return <CoursePage site={site} locale="en" />;
}
