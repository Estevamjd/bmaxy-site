import type { NextRequest } from "next/server";
import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { projetoIdSchema } from "@/lib/validation/writing";

function nomeAscii(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || "manuscrito";
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireStudent("/aluno/meu-livro");
  const copy = auth.locale === "en"
    ? { invalid: "Invalid project.", notFound: "Project not found.", failed: "We couldn't export the manuscript." }
    : { invalid: "Projeto inválido.", notFound: "Projeto não encontrado.", failed: "Não foi possível exportar o manuscrito." };
  const parsed = projetoIdSchema.safeParse({
    projectId: request.nextUrl.searchParams.get("projeto"),
  });

  if (!parsed.success) {
    return new Response(copy.invalid, {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("writing_projects")
    .select("id, title")
    .eq("id", parsed.data.projectId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  // ID inexistente e ID alheio são indistinguíveis de propósito.
  if (!project && !projectError) {
    return new Response(copy.notFound, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (projectError || !project) {
    return new Response(copy.failed, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { data: chapters, error: chaptersError } = await supabase
    .from("writing_chapters")
    .select("title, content, order_index")
    .eq("project_id", project.id)
    .eq("user_id", auth.userId)
    .order("order_index", { ascending: true });

  if (chaptersError) {
    return new Response(copy.failed, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const body = [
    project.title,
    ...(chapters ?? []).flatMap((chapter, index) => [
      "",
      chapter.title || `${auth.locale === "en" ? "Chapter" : "Capítulo"} ${index + 1}`,
      "",
      chapter.content,
    ]),
    "",
  ].join("\n");

  const fallback = `${nomeAscii(project.title)}.txt`;
  const utf8Name = encodeURIComponent(`${project.title.trim() || "manuscrito"}.txt`);

  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${utf8Name}`,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
