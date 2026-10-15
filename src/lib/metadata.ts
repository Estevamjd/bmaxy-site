import type { Metadata } from "next";
import { bookPath, pagePath, type PageKey } from "@/lib/routes";
import type { Locale, SiteContent } from "@/content/site";

/**
 * Monta os metadados de um root layout a partir do SiteContent do idioma.
 * A ESTRUTURA vive aqui uma vez só; cada layout.tsx (pt e en) só passa o
 * `site`/`locale` certos. `canonical` e `hreflang` da HOME apontam pt→"/" e
 * en→"/en"; cada página interna sobrescreve os seus com `buildPageMetadata`
 * ou `buildBookMetadata`, abaixo.
 */
export function buildLayoutMetadata(site: SiteContent, locale: Locale): Metadata {
  const pathname = locale === "en" ? "/en" : "/";

  return {
    metadataBase: new URL(site.meta.url),
    title: {
      default: site.meta.title,
      template: site.meta.titleTemplate,
    },
    description: site.meta.description,
    keywords: site.meta.keywords,
    applicationName: site.meta.company,
    authors: [{ name: site.meta.authorName, url: site.meta.url }],
    creator: site.meta.authorName,
    publisher: site.meta.company,
    alternates: {
      canonical: pathname,
      languages: {
        "pt-BR": "/",
        "en-US": "/en",
        "x-default": "/",
      },
    },
    openGraph: {
      type: "website",
      locale: site.meta.locale,
      url: pathname,
      siteName: site.meta.company,
      title: site.meta.title,
      description: site.meta.description,
    },
    twitter: {
      card: "summary_large_image",
      title: site.meta.title,
      description: site.meta.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    category: "books",
  };
}

/**
 * Metadados de uma página interna. O `canonical` aponta para a própria
 * página no idioma servido, e o `hreflang` liga o par pt/en — sem isso o
 * Google trata `/sobre` e `/en/about` como duas páginas concorrentes em vez
 * de duas traduções da mesma.
 *
 * `x-default` é sempre a versão em português: é o idioma padrão do site (a
 * home dele vive em "/", sem prefixo).
 */
export function buildPageMetadata({
  site,
  locale,
  key,
  title,
  description,
}: {
  site: SiteContent;
  locale: Locale;
  key: PageKey;
  title: string;
  description: string;
}): Metadata {
  return alternatesFor({
    site,
    locale,
    title,
    description,
    ptPath: pagePath(key, "pt"),
    enPath: pagePath(key, "en"),
  });
}

/** Igual ao anterior, para `/livros/[slug]` ↔ `/en/books/[slug]`. */
export function buildBookMetadata({
  site,
  locale,
  slug,
  title,
  description,
}: {
  site: SiteContent;
  locale: Locale;
  slug: string;
  title: string;
  description: string;
}): Metadata {
  return alternatesFor({
    site,
    locale,
    title,
    description,
    ptPath: bookPath(slug, "pt"),
    enPath: bookPath(slug, "en"),
  });
}

function alternatesFor({
  site,
  locale,
  title,
  description,
  ptPath,
  enPath,
}: {
  site: SiteContent;
  locale: Locale;
  title: string;
  description: string;
  ptPath: string;
  enPath: string;
}): Metadata {
  const canonical = locale === "en" ? enPath : ptPath;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        "pt-BR": ptPath,
        "en-US": enPath,
        "x-default": ptPath,
      },
    },
    openGraph: {
      type: "website",
      locale: site.meta.locale,
      url: canonical,
      siteName: site.meta.company,
      // O template "%s — BMaxy" do root layout não se aplica ao openGraph,
      // então o sufixo entra na mão aqui — senão o card compartilhado sairia
      // só com "Livros", sem dizer de quem é o site.
      title: `${title} — ${site.meta.company}`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${site.meta.company}`,
      description,
    },
  };
}
