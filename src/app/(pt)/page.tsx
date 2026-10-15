import HomeSections from "@/components/HomeSections";
import { getCatalogo } from "@/lib/dal/catalog";
import { siteContent } from "@/content/site";

/**
 * Home em português — rota "/", padrão do site.
 * A ordem das seções alterna os fundos --void / --deep / --bone de
 * propósito: é o que dá o ritmo da página. Ver HomeSections.tsx.
 */
export default async function HomePage() {
  const livros = await getCatalogo("pt");
  return <HomeSections site={siteContent.pt} livros={livros} />;
}
