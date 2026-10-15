import type { SiteContent } from "@/content/site";

/**
 * Imagem de compartilhamento (WhatsApp, LinkedIn, X), uma vez por idioma —
 * ver src/app/(pt)/opengraph-image.tsx e src/app/en/opengraph-image.tsx.
 *
 * O renderizador do next/og aceita só um subconjunto de CSS (flexbox, sem
 * grid) e não enxerga Tailwind nem custom properties — daí os valores hex
 * escritos à mão aqui. Se as cores da marca mudarem em globals.css, mude
 * também neste arquivo.
 */
export const ogImageSize = { width: 1200, height: 630 };

export function renderOgImage(site: SiteContent) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#07082A",
        padding: "64px 72px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", width: 28, height: 28, backgroundColor: "#FFC800" }} />
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: 2,
            color: "#FFFFFF",
          }}
        >
          {site.brand.wordmark}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            lineHeight: 1.02,
            letterSpacing: -2,
            color: "#FFFFFF",
            textTransform: "uppercase",
            maxWidth: 900,
          }}
        >
          {site.meta.tagline}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 34,
            fontSize: 27,
            lineHeight: 1.45,
            color: "#A9A6C8",
            maxWidth: 760,
          }}
        >
          {site.meta.description}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div style={{ display: "flex", width: 120, height: 4, backgroundColor: "#FFC800" }} />
        <div style={{ display: "flex", fontSize: 24, color: "#A9A6C8", letterSpacing: 3 }}>
          {site.meta.domain}
        </div>
      </div>
    </div>
  );
}
