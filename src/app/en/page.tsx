import HomeSections from "@/components/HomeSections";
import { getCatalogo } from "@/lib/dal/catalog";
import { siteContent } from "@/content/site";

/**
 * English home — route "/en", secondary language. Same section tree as the
 * Portuguese home (see HomeSections.tsx); only the content differs.
 */
export default async function HomePage() {
  const livros = await getCatalogo("en");
  return <HomeSections site={siteContent.en} livros={livros} />;
}
