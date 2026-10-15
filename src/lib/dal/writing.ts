import "server-only";
import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { WritingChapterRow, WritingProjectRow } from "@/lib/supabase/types";

/**
 * =============================================================================
 *  LEITURA DO ESTÚDIO DE ESCRITA
 * =============================================================================
 *
 *  Tudo aqui roda com o cliente AUTENTICADO do aluno, nunca com o service
 *  role. Quem decide o que aparece é a RLS — e neste caso a RLS é dona
 *  absoluta: as policies de `writing_projects` e `writing_chapters` comparam
 *  `user_id` com `auth.uid()` e não têm cláusula de administrador.
 *
 *  Consequência prática, e é a razão de este arquivo existir separado:
 *  **usar o cliente administrativo aqui derrubaria a única proteção do
 *  manuscrito.** Se algum dia alguém precisar de `createAdminClient()` nesta
 *  área, é sinal de que a decisão de privacidade mudou — e isso é conversa
 *  com o cliente, não refactor.
 *
 *  `requireStudent()` em toda função exportada, pelo mesmo motivo do
 *  `src/lib/dal/student.ts`: a guarda do layout não cobre `generateMetadata`,
 *  que roda de forma independente.
 */

export type CapituloResumo = {
  id: string;
  title: string;
  orderIndex: number;
  wordCount: number;
  updatedAt: string;
};

export type ProjetoComCapitulos = {
  id: string;
  title: string;
  genre: string;
  description: string;
  wordGoal: number | null;
  updatedAt: string;
  locale: "pt" | "en";
  chapters: CapituloResumo[];
  /** Soma feita aqui, a partir do que o banco calculou por capítulo. */
  totalWords: number;
};

function paraResumo(linha: WritingChapterRow): CapituloResumo {
  return {
    id: linha.id,
    title: linha.title,
    orderIndex: linha.order_index,
    wordCount: linha.word_count,
    updatedAt: linha.updated_at,
  };
}

/**
 * O projeto do aluno, com os capítulos.
 *
 * Devolve `null` quando não existe — que é o estado inicial de todo aluno, não
 * um erro. A tela precisa distinguir "ainda não criou" de "deu problema".
 *
 * Hoje é UM projeto por aluno (o mais recente). A tabela suporta vários e a
 * consulta já ordena por `updated_at`; quando a interface precisar de mais de
 * um, o que muda é a tela, não o schema.
 */
export async function getMeuProjeto(): Promise<ProjetoComCapitulos | null> {
  const auth = await requireStudent("/aluno/meu-livro");
  const supabase = await createClient();

  const { data: projeto, error: projectError } = await supabase
    .from("writing_projects")
    .select("*")
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<WritingProjectRow>();

  if (projectError) throw projectError;
  if (!projeto) return null;

  const { data: capitulos, error: chaptersError } = await supabase
    .from("writing_chapters")
    .select("*")
    .eq("project_id", projeto.id)
    .order("order_index", { ascending: true });

  if (chaptersError) throw chaptersError;
  const lista = (capitulos ?? []) as WritingChapterRow[];

  return {
    id: projeto.id,
    title: projeto.title,
    genre: projeto.genre,
    description: projeto.description,
    wordGoal: projeto.word_goal,
    updatedAt: projeto.updated_at,
    locale: auth.locale,
    chapters: lista.map(paraResumo),
    totalWords: lista.reduce((soma, c) => soma + c.word_count, 0),
  };
}

/**
 * Um capítulo com o conteúdo inteiro — é o que o editor abre.
 *
 * Separado de `getMeuProjeto` de propósito: a listagem não precisa carregar o
 * texto de todos os capítulos, e um manuscrito completo pode passar de um
 * megabyte. Trazer tudo em cada render seria pagar isso à toa.
 *
 * Não filtra por `user_id` no `.eq()`: a RLS já faz isso, e aqui ela é a
 * autoridade. Um id de outra pessoa simplesmente não retorna linha.
 */
export async function getCapitulo(
  chapterId: string,
  projectId: string,
): Promise<WritingChapterRow | null> {
  await requireStudent("/aluno/meu-livro");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("writing_chapters")
    .select("*")
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .maybeSingle<WritingChapterRow>();

  if (error) throw error;
  return data ?? null;
}

/**
 * Resumo para o dashboard: onde a pessoa parou.
 *
 * Devolve o capítulo editado mais recentemente, que é a resposta à pergunta
 * "onde eu estava?". Sem projeto, devolve `null` — e a tela mostra o convite
 * para começar, não um card vazio.
 */
export async function getResumoDoLivro(): Promise<{
  projectId: string;
  title: string;
  totalWords: number;
  wordGoal: number | null;
  chapterCount: number;
  ultimoCapitulo: CapituloResumo | null;
} | null> {
  const projeto = await getMeuProjeto();
  if (!projeto) return null;

  const ultimo = [...projeto.chapters].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1,
  )[0];

  return {
    projectId: projeto.id,
    title: projeto.title,
    totalWords: projeto.totalWords,
    wordGoal: projeto.wordGoal,
    chapterCount: projeto.chapters.length,
    ultimoCapitulo: ultimo ?? null,
  };
}
