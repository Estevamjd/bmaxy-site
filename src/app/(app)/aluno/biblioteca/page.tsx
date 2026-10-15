import Image from "next/image";
import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/platform/ui";
import { siteContent } from "@/content/site";
import { studentContent } from "@/content/student";
import { requireStudent } from "@/lib/auth/session";
import { getCatalogo } from "@/lib/dal/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireStudent("/aluno/biblioteca");
  return { title: studentContent[auth.locale].meta.library };
}

export default async function StudentLibraryPage() {
  const auth = await requireStudent("/aluno/biblioteca");
  const copy = studentContent[auth.locale].library;
  const books = siteContent[auth.locale].books;

  /* A biblioteca do aluno mostra o MESMO catálogo público, do mesmo lugar.
     Enquanto ela lia de `site.ts` e a vitrine lia do banco, as duas telas
     podiam discordar sobre preço, capa ou quais livros existem — e o aluno
     veria um catálogo desatualizado sem ninguém perceber. */
  const livros = await getCatalogo(auth.locale);

  return (
    <div>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <Panel className="mt-8 border-l-2 border-l-gold p-5 text-sm leading-relaxed text-ash">
        {copy.note}
        {books.titleNote ? <span className="ml-1 text-warm-white">{books.titleNote}</span> : null}
      </Panel>

      <ul className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {livros.map((book) => (
          <li key={book.slug}>
            <Panel className="flex h-full flex-col overflow-hidden p-0">
              <div className="relative aspect-[2/3] overflow-hidden bg-panel-hi">
                <Image
                  src={book.cover.src}
                  alt={book.cover.alt}
                  width={book.cover.width}
                  height={book.cover.height}
                  sizes="(min-width: 1280px) 24vw, (min-width: 640px) 44vw, 90vw"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="display text-[1.25rem] leading-tight text-warm-white">{book.title}</h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ash">{book.synopsis}</p>
                <p className="label-eyebrow mt-6 text-gold">{copy.buyAt}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[book.links.amazon, book.links.clubeDeAutores].map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-[3px] border border-panel-line px-3 py-2 text-xs text-warm-white transition-colors hover:border-gold hover:text-gold"
                    >
                      {link.label}
                      <span className="sr-only"> {copy.externalHint}</span>
                    </a>
                  ))}
                </div>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </div>
  );
}
