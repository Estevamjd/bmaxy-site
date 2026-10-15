import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { adminContent } from "../src/content/admin.ts";
import { legalContent } from "../src/content/legal.ts";
import { platformContent } from "../src/content/platform.ts";
import { siteContent } from "../src/content/site.ts";
import { studentContent } from "../src/content/student.ts";
import { writingContent } from "../src/content/writing.ts";

const PORTUGUESE_UI = /[áàâãéêíóôõúç]|\b(?:de|Área|Aluno|Alunos|Aula|Aulas|Biblioteca|Buscar|Cancelar|Capítulo|Criar|Curso|Cursos|Em breve|Entrar|Escrita|Excluir|Idioma|Início|Livro|Módulo|Nenhum|Painel|Português|Rascunho|Recuperar|Salvar|Senha|Sair|Voltar)\b/i;

/**
 * Nomes próprios. Não são "texto em português esquecido na interface" — são o
 * nome real de uma pessoa, de uma empresa ou de uma loja, e traduzi-los criaria
 * uma entidade que não existe.
 *
 * "Clube de Autores" é a editora brasileira onde os livros são vendidos. O site
 * em inglês já a chamava assim ("Clube de Autores (Brazil)") desde antes do
 * catálogo administrável; a entrada aparece aqui agora porque os rótulos do
 * painel passaram a citá-la, e o painel é um dos arquivos que este teste
 * inspeciona. O domínio entra junto pelo mesmo motivo: ele é o endereço da
 * loja, não uma frase.
 */
const OFFICIAL_ALLOWLIST = [
  "BMAXY",
  "Rodrigo Gambini",
  "seu-livro",
  "contact@bmaxy.com",
  "Clube de Autores",
  "clubedeautores.com.br",
];

function isAllowed(value: string): boolean {
  return OFFICIAL_ALLOWLIST.some((allowed) => value.includes(allowed));
}

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
  return output;
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test("o conteúdo inglês centralizado não contém texto de interface em português", () => {
  const strings = [platformContent.en, studentContent.en, writingContent.en, adminContent.en]
    .flatMap((content) => collectStrings(content));
  const offenders = strings.filter((value) => PORTUGUESE_UI.test(value) && !isAllowed(value));
  assert.deepEqual(offenders, []);
});

test("a experiência em inglês não mistura o nome português do curso", () => {
  const englishContent = JSON.stringify([
    siteContent.en,
    platformContent.en,
    studentContent.en,
    legalContent.en,
  ]);
  assert.doesNotMatch(englishContent, /Seu Livro/);
  assert.match(englishContent, /Write Your Book/);
});

test("a seção de números exibe quatro métricas verificáveis nos dois idiomas", () => {
  assert.equal(siteContent.pt.stats.items.length, 4);
  assert.equal(siteContent.en.stats.items.length, 4);
  assert.deepEqual(siteContent.en.stats.items.map(({ value }) => value), ["32", "6", "3", "2"]);
});

test("a interface autenticada não reintroduz texto português hardcoded", () => {
  const roots = ["src/app/(app)"];
  const offenders: string[] = [];

  for (const file of roots.flatMap(sourceFiles).filter((path) => path.endsWith(".tsx"))) {
    const source = readFileSync(file, "utf8");
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

    const visit = (node: ts.Node) => {
      let value: string | null = null;
      if (ts.isStringLiteralLike(node)) {
        if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) return;
        value = node.text;
      } else if (ts.isJsxText(node)) {
        value = node.text.trim();
      }

      const internalToken = /^[a-z0-9_-]+$/.test(value ?? "");
      if (value && PORTUGUESE_UI.test(value) && !isAllowed(value) && !value.startsWith("/") && !internalToken) {
        const line = tree.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        offenders.push(`${file}:${line}: ${JSON.stringify(value)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }

  assert.deepEqual(offenders, []);
});

test("o trigger de cadastro aceita somente en e mantém execução interna", () => {
  const migration = readFileSync(
    "supabase/migrations/20260805090645_initialize_profile_locale.sql",
    "utf8",
  );
  assert.match(migration, /case when new\.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'pt' end/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/i);
});
