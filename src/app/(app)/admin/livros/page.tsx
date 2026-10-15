import Link from "next/link";
import type { Metadata } from "next";
import { adminContent, formatAdminMessage } from "@/content/admin";
import { requireAdmin } from "@/lib/auth/session";
import { IconBooks } from "@/components/platform/icons";
import {
  DataTable,
  EmptyState,
  InfoNotice,
  PageHeader,
  Panel,
  SectionHeading,
  StatusBadge,
  type DataTableColumn,
} from "@/components/platform/ui";
import { getCotacaoAdmin, listarLivros, type LivroAdmin } from "@/lib/dal/catalog";
import { formatarBRL } from "@/lib/money";
import { BookOrderButtons, CreateBookForm, RateForm } from "./BookForms";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireAdmin("/admin/livros");
  return { title: adminContent[auth.locale].books.title };
}

/**
 * A lista do catálogo.
 *
 * `searchParams` guarda busca e filtro em vez de estado no cliente: assim o
 * administrador pode voltar do editor sem perder o que estava filtrando, e o
 * link é compartilhável. O formulário é um GET comum — sem JavaScript ele
 * continua funcionando.
 *
 * O filtro padrão esconde os ARQUIVADOS. Foi para isso que arquivar existe:
 * tirar da frente sem apagar. Eles continuam a um clique de distância.
 */
export default async function AdminBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>;
}) {
  const auth = await requireAdmin("/admin/livros");
  const copy = adminContent[auth.locale];
  const text = copy.books;

  const { busca = "", status = "" } = await searchParams;
  const statusFiltro =
    status === "published" || status === "draft" || status === "archived" || status === "all"
      ? status
      : undefined;

  const [todos, cotacao] = await Promise.all([
    listarLivros({ busca, status: statusFiltro }),
    getCotacaoAdmin(),
  ]);

  /* Sem filtro explícito, arquivados ficam fora. Com "todas" ou com o filtro
     de arquivados, aparecem. */
  const livros = statusFiltro ? todos : todos.filter((livro) => livro.status !== "archived");

  /* A reordenação vale sobre a ORDEM REAL do catálogo, não sobre a lista
     filtrada — senão a seta "subir" de um livro visível o trocaria com um
     livro que a busca escondeu, e o resultado pareceria aleatório. */
  const ordemCompleta = await listarLivros();
  const primeiro = ordemCompleta[0]?.id;
  const ultimo = ordemCompleta[ordemCompleta.length - 1]?.id;

  const precoOu = (centavos: number | null, ausente: string) =>
    centavos === null ? ausente : formatarBRL(centavos);

  const tomStatus = (s: LivroAdmin["status"]) =>
    s === "published" ? "success" : s === "archived" ? "muted" : "warning";

  const rotuloStatus = (s: LivroAdmin["status"]) =>
    s === "published" ? copy.common.published : s === "archived" ? text.archived : copy.common.draft;

  const columns: DataTableColumn<LivroAdmin>[] = [
    {
      key: "order",
      header: text.columnOrder,
      cell: (livro) => (
        <BookOrderButtons
          book={livro}
          isFirst={livro.id === primeiro}
          isLast={livro.id === ultimo}
          content={copy}
        />
      ),
    },
    {
      key: "book",
      header: text.columnBook,
      cell: (livro) => (
        <Link
          href={`/admin/livros/${livro.id}`}
          className="block min-w-0 transition-colors duration-200 hover:text-gold"
        >
          <span className="block truncate">{livro.title}</span>
          <span className="block truncate text-xs text-ash">/{livro.slug}</span>
        </Link>
      ),
    },
    {
      key: "prices",
      header: text.columnPrices,
      cell: (livro) => (
        <span className="block text-xs leading-relaxed text-ash">
          <span className="block">{precoOu(livro.printPriceCents, text.noPrintPrice)}</span>
          <span className="block">{precoOu(livro.ebookPriceCents, text.noEbookPrice)}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: text.columnStatus,
      align: "right",
      cell: (livro) => (
        <StatusBadge tone={tomStatus(livro.status)}>{rotuloStatus(livro.status)}</StatusBadge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={copy.common.management}
        title={text.title}
        description={text.subtitle}
      />

      <div className="mt-8">
        <CreateBookForm content={copy} />
      </div>

      {/* GET simples: sem JavaScript, a busca continua funcionando. */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="busca" className="label-eyebrow block text-ash">
            {text.searchLabel}
          </label>
          <input
            id="busca"
            name="busca"
            type="search"
            defaultValue={busca}
            placeholder={text.searchPlaceholder}
            className="mt-1.5 w-full rounded-[3px] border border-panel-line bg-void px-3.5 py-2.5 font-sans text-sm text-warm-white placeholder:text-ash/60 transition-colors duration-200 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40"
          />
        </div>

        <div>
          <label htmlFor="status" className="label-eyebrow block text-ash">
            {text.filterLabel}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusFiltro ?? ""}
            className="mt-1.5 rounded-[3px] border border-panel-line bg-void px-3.5 py-2.5 font-sans text-sm text-warm-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40"
          >
            <option value="" className="bg-void">
              {text.filterPublished} + {text.filterDraft}
            </option>
            <option value="all" className="bg-void">
              {text.filterAll}
            </option>
            <option value="published" className="bg-void">
              {text.filterPublished}
            </option>
            <option value="draft" className="bg-void">
              {text.filterDraft}
            </option>
            <option value="archived" className="bg-void">
              {text.filterArchived}
            </option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-[3px] border border-panel-line px-4 py-2.5 font-sans text-sm text-warm-white transition-colors duration-200 hover:border-ash"
        >
          {text.searchLabel}
        </button>
      </form>

      <p className="mt-4 text-xs text-ash">
        {livros.length === 1
          ? text.countOne
          : formatAdminMessage(text.countMany, { count: livros.length })}
      </p>

      <div className="mt-4">
        {livros.length === 0 ? (
          <EmptyState
            icon={<IconBooks className="h-6 w-6" />}
            title={busca || statusFiltro ? text.emptyFiltered : text.empty}
            description={text.subtitle}
          />
        ) : (
          <DataTable
            caption={text.title}
            columns={columns}
            rows={livros}
            rowKey={(livro) => livro.id}
            empty={text.emptyFiltered}
            mobileCard={(livro) => (
              <div>
                <Link href={`/admin/livros/${livro.id}`} className="block">
                  <span className="block text-sm text-warm-white">{livro.title}</span>
                  <span className="block text-xs text-ash">/{livro.slug}</span>
                </Link>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusBadge tone={tomStatus(livro.status)}>
                    {rotuloStatus(livro.status)}
                  </StatusBadge>
                  <BookOrderButtons
                    book={livro}
                    isFirst={livro.id === primeiro}
                    isLast={livro.id === ultimo}
                    content={copy}
                  />
                </div>
              </div>
            )}
          />
        )}
      </div>

      <div className="mt-6">
        <InfoNotice>{text.noDeleteNote}</InfoNotice>
      </div>

      <div className="mt-10">
        <Panel className="p-6">
          <SectionHeading title={text.rateTitle} as="h2" />
          <RateForm
            taxa={cotacao.taxa}
            atualizadaEm={cotacao.atualizadaEm}
            content={copy}
            locale={auth.locale}
          />
        </Panel>
      </div>
    </div>
  );
}
