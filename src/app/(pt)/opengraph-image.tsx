import { ImageResponse } from "next/og";
import { siteContent } from "@/content/site";
import { ogImageSize, renderOgImage } from "@/lib/og-image";

const site = siteContent.pt;

export const alt = site.meta.ogAlt;
export const size = ogImageSize;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(renderOgImage(site), size);
}
