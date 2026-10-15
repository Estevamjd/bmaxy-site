import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminContent, formatAdminMessage } from "@/content/admin";
import { requireAdmin } from "@/lib/auth/session";
import {
  InfoNotice,
  PageHeader,
  Panel,
  SectionHeading,
  StatusBadge,
} from "@/components/platform/ui";
import {
  getCotacaoAdmin,
  getLivroParaEdicao,
  getLivroParaPreview,
  type LivroPublico,
} from "@/lib/dal/catalog";
import { formatarTaxa } from "@/lib/money";
import { BookEditForm, BookStatusForms, CoverForm } from "../BookForms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const auth = await requireAdmin("/admin/livros");
  const { id } = await params;
  const livro = await getLivroParaEdicao(id);
  return { title: livro?.title ?? adminContent[auth.locale].books.title };
}

/**
 * O editor de um livro.
 *
 * A PRÉ-VISUALIZAÇÃO fica aqui, na mesma página do botão de publicar, e não
 * numa rota separada. É onde a decisão acontece: quem está prestes a publicar
 * quer ver como ficou sem perder o formulário de vista. Uma rota `/preview`
 * separada obrigaria a ir e voltar, e na prática ninguém iria.
 *
 * Ela mostra os DOIS idiomas lado a lado porque o preço em dólar é calculado —
 * ver a conversão aplicada é a única forma de conferir a cotação antes de o
 * visitante conferir por nós.
 */
export default async function AdminBookEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAdmin("/admin/livros");
  const copy = adminContent[auth.locale];
  const text = copy.books;

  const { id } = await params;

  /* `getLivroParaEdicao` devolve null tanto para "não existe" quanto para "a
     RLS não deixou ler" — e nos dois casos 404 é a resposta certa. Distinguir
     confirmaria a existência do registro para quem não pode vê-lo. */
  const livro = await getLivroParaEdicao(id);
  if (!livro) notFound();

  const [previewPt, previewEn, cotacao] = await Promise.all([
    getLivroParaPreview(id, "pt"),
    getLivroParaPreview(id, "en"),
    getCotacaoAdmin(),
  ]);

  const tom =
    livro.status === "published" ? "success" : livro.status === "archived" ? "muted" : "warning";
  const rotulo =
    livro.status === "published"
      ? copy.common.published
      : livro.status === "archived"
        ? text.archived
        : copy.common.draft;

  return (
    <div>
      <PageHeader
        eyebrow={text.title}
        title={livro.title}
        description={`/${livro.slug}`}
        backHref="/admin/livros"
        backLabel={text.back}
        actions={<StatusBadge tone={tom}>{rotulo}</StatusBadge>}
      />

      <div className="mt-8">
        <Panel className="p-6">
          <SectionHeading title={text.columnStatus} />
          <div className="mt-4">
            <BookStatusForms book={livro} content={copy} />
          </div>
          {livro.status === "published" ? (
            <p className="mt-4 text-xs text-ash">
              <Link
                href={`/livros/${livro.slug}`}
                className="link-underline"
                target="_blank"
                rel="noreferrer"
              >
                {text.open}: /livros/{livro.slug}
              </Link>
            </p>
          ) : null}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel className="px-6">
          <BookEditForm book={livro} content={copy} />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel className="p-6">
          <SectionHeading title={text.sectionCover} />

          <div className="mt-5 grid gap-6 sm:grid-cols-[10rem_1fr]">
            <div>
              <p className="label-eyebrow text-ash">{text.coverCurrent}</p>
              {livro.cover.url ? (
                <Image
                  src={livro.cover.url}
                  alt=""
                  width={livro.cover.width ?? 400}
                  height={livro.cover.height ?? 600}
                  className="mt-2 w-full rounded-[3px] border border-panel-line"
                />
              ) : (
                <p className="mt-2 text-sm text-ash">{text.coverNone}</p>
              )}
            </div>

            <CoverForm book={livro} content={copy} />
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel className="p-6">
          <SectionHeading title={text.previewTitle} description={text.previewLead} />

          {/* Qual cotação está por trás dos valores em inglês mostrados
              abaixo. Sem isto, "Approx. US$ 14.50" é um número sem origem
              visível, e conferir a conversão exigiria abrir outra página. */}
          <div className="mt-3">
            <InfoNotice>
              {formatAdminMessage(text.rateCurrent, { rate: formatarTaxa(cotacao.taxa) })}
            </InfoNotice>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <PreviewColumn title={text.previewPt} livro={previewPt} vazio={text.noPrice} />
            <PreviewColumn title={text.previewEn} livro={previewEn} vazio={text.noPrice} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/**
 * Uma coluna da pré-visualização.
 *
 * A sinopse é renderizada como TEXTO, dentro de um <p>. Nunca como HTML: o
 * campo é livre e o que o administrador digitar não deve virar marcação. O
 * React já escapa por padrão — o que importa aqui é não haver
 * `dangerouslySetInnerHTML` em lugar nenhum deste arquivo, hoje nem depois.
 */
function PreviewColumn({
  title,
  livro,
  vazio,
}: {
  title: string;
  livro: LivroPublico | null;
  vazio: string;
}) {
  if (!livro) return null;

  return (
    <div>
      <p className="label-eyebrow text-ash">{title}</p>

      <div className="mt-4 flex gap-4">
        {livro.cover.src ? (
          <Image
            src={livro.cover.src}
            alt={livro.cover.alt}
            width={livro.cover.width}
            height={livro.cover.height}
            className="h-auto w-24 shrink-0 rounded-[3px] border border-panel-line"
          />
        ) : null}

        <div className="min-w-0">
          <p className="display text-[1.0625rem] text-warm-white">{livro.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-ash">{livro.synopsis}</p>

          <ul className="mt-3 space-y-1 text-xs text-ash">
            <li>{livro.price ?? vazio}</li>
            <li>{livro.ebookPrice ?? vazio}</li>
          </ul>

          <ul className="mt-3 space-y-1 text-xs">
            {[livro.links.amazon, livro.links.clubeDeAutores]
              .filter((link) => link.href !== "")
              .map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="link-underline text-ash"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
