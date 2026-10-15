import type { Metadata } from "next";
import Link from "next/link";
import { ChapterEditor } from "@/components/platform/ChapterEditor";
import {
  EmptyState,
  MetricCard,
  MetricGrid,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeading,
} from "@/components/platform/ui";
import { getCapitulo, getMeuProjeto } from "@/lib/dal/writing";
import { requireStudent } from "@/lib/auth/session";
import { writingContent } from "@/content/writing";
import {
  CriarCapituloForm,
  CriarProjetoForm,
  DadosDoProjetoForm,
  ExcluirCapituloForm,
  ExcluirProjetoForm,
  MoverCapituloForm,
} from "./WritingForms";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await requireStudent("/aluno/meu-livro");
  return { title: writingContent[auth.locale].metaTitle };
}

/**
 * =============================================================================
 *  ESTÚDIO DE ESCRITA
 * =============================================================================
 *
 *  Três estados, e nenhum deles é um card vazio:
 *
 *    sem projeto   → convite para começar, com um campo só
 *    com projeto   → lista de capítulos + editor do capítulo aberto
 *    sem capítulo  → o projeto existe mas ficou sem capítulos (a pessoa
 *                    apagou todos); oferece criar de novo
 *
 *  O capítulo aberto vem por query string (`?capitulo=<uuid>`) em vez de rota
 *  aninhada: o Estúdio é uma tela só, e uma rota por capítulo faria a lista
 *  remontar a cada troca — perdendo o foco de quem está escrevendo.
 *
 *  Um uuid de outra pessoa na query string simplesmente não retorna capítulo:
 *  quem filtra é a RLS, e ela compara com `auth.uid()`. Não há verificação de
 *  propriedade escrita aqui porque ela não estaria protegendo nada — o banco
 *  já respondeu vazio.
 */
export default async function MeuLivroPage({
  searchParams,
}: {
  searchParams: Promise<{ capitulo?: string }>;
}) {
  const { capitulo: capituloPedido } = await searchParams;
  const [auth, projeto] = await Promise.all([
    requireStudent("/aluno/meu-livro"),
    getMeuProjeto(),
  ]);
  const copy = writingContent[auth.locale];

  /* ------------------------------ sem projeto ---------------------------- */
  if (!projeto) {
    return (
      <>
        <PageHeader
          eyebrow={copy.eyebrow}
          title={copy.emptyTitle}
          description={copy.privateDescription}
        />
        <Panel>
          <SectionHeading title={copy.projectPrompt} />
          <p className="measure mt-3 text-sm leading-relaxed text-ash">
            {copy.projectPromptBody}
          </p>
          <div className="mt-6 max-w-lg">
            <CriarProjetoForm
              labels={copy.create}
            />
          </div>
        </Panel>
      </>
    );
  }

  const capituloAberto = capituloPedido
    ? await getCapitulo(capituloPedido, projeto.id)
    : projeto.chapters[0]
      ? await getCapitulo(projeto.chapters[0].id, projeto.id)
      : null;

  const meta = projeto.wordGoal;
  const numberLocale = auth.locale === "en" ? "en-US" : "pt-BR";
  const percentual = meta ? Math.min(100, Math.round((projeto.totalWords / meta) * 100)) : null;

  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={projeto.title}
        description={copy.onlyYou}
      />

      <MetricGrid>
        <MetricCard label={copy.metrics.words} value={projeto.totalWords.toLocaleString(numberLocale)} />
        <MetricCard label={copy.metrics.chapters} value={String(projeto.chapters.length)} />
        <MetricCard
          label={copy.metrics.goal}
          value={meta ? meta.toLocaleString(numberLocale) : "—"}
          hint={meta ? undefined : copy.metrics.goalHint}
        />
        <MetricCard
          label={copy.metrics.progress}
          value={percentual === null ? "—" : `${percentual}%`}
        />
      </MetricGrid>

      {meta ? (
        <div className="mt-6">
          <ProgressBar
            value={projeto.totalWords}
            max={meta}
            label={copy.metrics.progress}
            ofLabel={copy.progressOf}
          />
        </div>
      ) : null}

      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        {/* --------------------------- capítulos --------------------------- */}
        <div className="lg:col-span-4">
          <Panel>
            <SectionHeading title={copy.chapters} />

            {projeto.chapters.length === 0 ? (
              <p className="mt-4 text-sm leading-relaxed text-ash">
                {copy.noChapters}
              </p>
            ) : (
              <ul className="mt-5 space-y-2">
                {projeto.chapters.map((c, indice) => {
                  const ativo = capituloAberto?.id === c.id;
                  return (
                    <li
                      key={c.id}
                      className={`rounded-[3px] border px-3 py-3 transition-colors ${
                        ativo ? "border-gold bg-panel-hi" : "border-panel-line"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/aluno/meu-livro?capitulo=${c.id}`}
                          className="min-w-0 flex-1"
                          aria-current={ativo ? "page" : undefined}
                        >
                          <span className="block truncate text-[0.9375rem] text-white">
                            {c.title || copy.chapterFallback(indice + 1)}
                          </span>
                          <span className="mt-1 block text-xs text-ash">
                            {c.wordCount.toLocaleString(numberLocale)} {copy.words}
                          </span>
                        </Link>

                        <div className="flex shrink-0 gap-1">
                          <MoverCapituloForm
                            chapterId={c.id}
                            direction="up"
                            label={copy.moveUp(c.title || copy.chapterFallback(indice + 1))}
                            disabled={indice === 0}
                          />
                          <MoverCapituloForm
                            chapterId={c.id}
                            direction="down"
                            label={copy.moveDown(c.title || copy.chapterFallback(indice + 1))}
                            disabled={indice === projeto.chapters.length - 1}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-5">
              <CriarCapituloForm
                projectId={projeto.id}
                label={copy.newChapter}
                pending={copy.creating}
              />
            </div>
          </Panel>
        </div>

        {/* ---------------------------- editor ----------------------------- */}
        <div className="lg:col-span-8">
          {capituloAberto ? (
            <Panel>
              <ChapterEditor
                key={capituloAberto.id}
                chapterId={capituloAberto.id}
                initialTitle={capituloAberto.title}
                initialContent={capituloAberto.content}
                initialWordCount={capituloAberto.word_count}
                locale={numberLocale}
                labels={copy.editor}
              />

              <div className="mt-8 border-t border-panel-line pt-6">
                <ExcluirCapituloForm
                  chapterId={capituloAberto.id}
                  labels={copy.deleteChapter}
                />
              </div>
            </Panel>
          ) : (
            <Panel>
              <EmptyState
                title={copy.noOpenChapter}
                description={copy.noOpenChapterBody}
              />
            </Panel>
          )}
        </div>
      </div>

      {/* ------------------------- dados do livro -------------------------- */}
      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Panel>
            <SectionHeading
              title={copy.bookData}
              description={copy.bookDataBody}
            />
            <div className="mt-6">
              <DadosDoProjetoForm
                projectId={projeto.id}
                title={projeto.title}
                genre={projeto.genre}
                description={projeto.description}
                wordGoal={projeto.wordGoal}
                labels={copy.fields}
              />
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-5">
          <Panel>
            <SectionHeading title={copy.copyAndDelete} />

            <p className="measure mt-3 text-sm leading-relaxed text-ash">
              {copy.exportBody}
            </p>
            <a
              href={`/aluno/meu-livro/exportar?projeto=${projeto.id}`}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[3px] border border-panel-line px-5 py-2.5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-white transition-colors duration-300 hover:border-gold hover:text-gold"
            >
              {copy.export}
            </a>

            <div className="mt-8 border-t border-panel-line pt-6">
              <ExcluirProjetoForm
                projectId={projeto.id}
                labels={copy.deleteProject}
              />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
