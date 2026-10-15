import type { Locale, SiteContent } from "@/content/site";

/** JSON-LD: a empresa e a pessoa por trás dela, uma vez por idioma. */
export default function StructuredData({
  site,
  locale,
}: {
  site: SiteContent;
  locale: Locale;
}) {
  const pageUrl = locale === "en" ? `${site.meta.url}/en` : site.meta.url;
  const inLanguage = locale === "en" ? "en-US" : "pt-BR";

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site.meta.url}/#organization`,
        name: site.meta.company,
        alternateName: site.brand.wordmark,
        url: site.meta.url,
        slogan: site.meta.tagline,
        description: site.meta.description,
        founder: { "@id": `${site.meta.url}/#person` },
        sameAs: site.meta.authorSameAs,
      },
      {
        "@type": "Person",
        "@id": `${site.meta.url}/#person`,
        name: site.meta.authorName,
        jobTitle: site.meta.authorJobTitle,
        url: site.meta.url,
        nationality: "BR",
        worksFor: { "@id": `${site.meta.url}/#organization` },
        sameAs: site.meta.authorSameAs,
      },
      {
        "@type": "WebSite",
        "@id": `${pageUrl}/#website`,
        url: pageUrl,
        name: site.meta.company,
        inLanguage,
        publisher: { "@id": `${site.meta.url}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
