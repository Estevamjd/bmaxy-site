import type { Metadata, Viewport } from "next";
import AppShell from "@/components/AppShell";
import { siteContent } from "@/content/site";
import { buildLayoutMetadata } from "@/lib/metadata";
import "../globals.css";

const site = siteContent.pt;

export const metadata: Metadata = buildLayoutMetadata(site, "pt");

export const viewport: Viewport = {
  themeColor: "#07082A",
  colorScheme: "dark",
};

export default function PtRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell site={site} locale="pt">
      {children}
    </AppShell>
  );
}
