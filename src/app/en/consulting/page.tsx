import type { Metadata } from "next";
import ServicePage from "@/components/pages/ServicePage";
import { siteContent } from "@/content/site";
import { buildPageMetadata } from "@/lib/metadata";

const site = siteContent.en;

export const metadata: Metadata = buildPageMetadata({
  site,
  locale: "en",
  key: "consulting",
  title: "Book Coaching",
  description: site.pages.consulting.lead,
});

export default function Page() {
  return <ServicePage site={site} locale="en" content={site.pages.consulting} />;
}
