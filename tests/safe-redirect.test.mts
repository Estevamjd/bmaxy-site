import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInternalPath, safeRedirectTarget } from "../src/lib/auth/safe-redirect.ts";

test("caminho interno relativo passa direto", () => {
  assert.equal(safeRedirectTarget("/aluno", "/entrar"), "/aluno");
  assert.equal(safeRedirectTarget("/admin/alunos", "/entrar"), "/admin/alunos");
  assert.equal(safeRedirectTarget("/aluno/curso/seu-livro", "/entrar"), "/aluno/curso/seu-livro");
});

test("null/undefined/vazio cai no fallback", () => {
  assert.equal(safeRedirectTarget(null, "/aluno"), "/aluno");
  assert.equal(safeRedirectTarget(undefined, "/aluno"), "/aluno");
  assert.equal(safeRedirectTarget("", "/aluno"), "/aluno");
});

test("URL absoluta é rejeitada (open redirect)", () => {
  assert.equal(safeRedirectTarget("https://evil.example.com", "/aluno"), "/aluno");
  assert.equal(safeRedirectTarget("http://evil.example.com/phish", "/aluno"), "/aluno");
});

test('protocol-relative "//host" é rejeitado', () => {
  // Sem esquema, o navegador ainda resolve "//host" como um destino
  // externo (herda o protocolo da página atual) — precisa cair no mesmo
  // caminho do teste anterior.
  assert.equal(safeRedirectTarget("//evil.example.com", "/aluno"), "/aluno");
  assert.equal(safeRedirectTarget("//evil.example.com/aluno", "/aluno"), "/aluno");
});

test('variante com barra invertida ("/\\\\host") é rejeitada', () => {
  // Alguns navegadores tratam "/\\host" como equivalente a "//host".
  assert.equal(safeRedirectTarget("/\\evil.example.com", "/aluno"), "/aluno");
});

test('caminho que não começa com "/" é rejeitado', () => {
  assert.equal(safeRedirectTarget("aluno", "/entrar"), "/entrar");
  assert.equal(safeRedirectTarget("javascript:alert(1)", "/entrar"), "/entrar");
});

test("caminho relativo com query string é preservado", () => {
  assert.equal(
    safeRedirectTarget("/aluno/curso/seu-livro?ref=email", "/aluno"),
    "/aluno/curso/seu-livro?ref=email",
  );
});

/* ==========================================================================
   Vetores encontrados na auditoria de segurança
   ==========================================================================
   A versão anterior era uma lista de prefixos proibidos, e lista de proibidos
   sempre tem mais um caso. Estes são os casos que ela deixava passar. */

test("caractere de controle no meio do caminho é rejeitado (open redirect real)", () => {
  // TAB é caractere VÁLIDO em header HTTP: o Location saía intacto e o
  // navegador, ao remover o TAB, resolvia para https://evil.com/.
  const vetores = [
    "/\u0009/evil.com",
    "/\u0009\\evil.com",
    "/\u0009\u0009//evil.com",
    "/\u000A/evil.com",
    "/\u000D/evil.com",
    "/\u0000/evil.com",
    "/\u007F/evil.com",
  ];
  for (const vetor of vetores) {
    assert.equal(safeRedirectTarget(vetor, "/casa"), "/casa", JSON.stringify(vetor));
  }
});

test("backslash em qualquer posição é rejeitado, não só no prefixo", () => {
  for (const vetor of ["/aluno\\..\\..\\admin", "/a\\b", "/admin\\"]) {
    assert.equal(safeRedirectTarget(vetor, "/casa"), "/casa", vetor);
  }
});

test("travessia de diretório é normalizada, não repassada crua", () => {
  // Sem normalizar, a checagem de área por prefixo (roles.ts) seria
  // contornável escrevendo o mesmo destino de outro jeito.
  assert.equal(safeRedirectTarget("/aluno/../admin", "/casa"), "/admin");
  assert.equal(safeRedirectTarget("/admin/./cursos", "/casa"), "/admin/cursos");
  assert.equal(safeRedirectTarget("/aluno//curso", "/casa"), "/aluno//curso");
});

test("destino absurdamente longo é rejeitado", () => {
  assert.equal(safeRedirectTarget(`/${"a".repeat(600)}`, "/casa"), "/casa");
});

test("o hash é descartado — nunca chega ao servidor", () => {
  assert.equal(safeRedirectTarget("/aluno#secao", "/casa"), "/aluno");
  assert.equal(safeRedirectTarget("/aluno?x=1#secao", "/casa"), "/aluno?x=1");
});

test("normalizeInternalPath distingue ausente de inválido devolvendo null", () => {
  assert.equal(normalizeInternalPath(null), null);
  assert.equal(normalizeInternalPath(""), null);
  assert.equal(normalizeInternalPath("https://evil.com"), null);
  assert.equal(normalizeInternalPath("/aluno"), "/aluno");
});
