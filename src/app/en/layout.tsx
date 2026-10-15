import type { Metadata, Viewport } from "next";
import AppShell from "@/components/AppShell";
import { siteContent } from "@/content/site";
import { buildLayoutMetadata } from "@/lib/metadata";
import "../globals.css";

const site = siteContent.en;

export const metadata: Metadata = buildLayoutMetadata(site, "en");

export const viewport: Viewport = {
  themeColor: "#07082A",
  colorScheme: "dark",
};

export default function EnRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell site={site} locale="en">
      {children}
    </AppShell>
  );
}
