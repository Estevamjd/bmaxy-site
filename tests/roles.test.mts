import assert from "node:assert/strict";
import test from "node:test";
import {
  areaForPath,
  homePathForRole,
  isPathAllowedForRole,
  resolvePostAuthDestination,
} from "../src/lib/auth/roles.ts";

/**
 * A separação entre administrador e aluno.
 *
 * Estes testes existem por causa de uma auditoria que encontrou administrador
 * navegando pela ÁREA DO ALUNO — e vendo, lá dentro, curso em rascunho (as
 * policies de admin são `is_admin() OR ...`, então a RLS não filtra nada para
 * ele). A causa raiz era simples: três arquivos transformavam a AUSÊNCIA de
 * `?next` em "/aluno" ANTES de saber quem tinha logado.
 *
 * Aqui se testa a regra pura. O comportamento das rotas de verdade é validado
 * contra o Supabase real — ver docs/QA-CHECKLIST.md.
 */

/* ------------------------------ casa da role ------------------------------ */

test("cada role tem uma casa, e elas são diferentes", () => {
  assert.equal(homePathForRole("admin"), "/admin");
  assert.equal(homePathForRole("student"), "/aluno");
});

/* -------------------------------- áreas ----------------------------------- */

test("as rotas de cada área são reconhecidas, inclusive sub-rotas", () => {
  assert.equal(areaForPath("/aluno"), "student");
  assert.equal(areaForPath("/aluno/curso/seu-livro"), "student");
  assert.equal(areaForPath("/aluno/aula/abc"), "student");
  assert.equal(areaForPath("/admin"), "admin");
  assert.equal(areaForPath("/admin/alunos"), "admin");
  assert.equal(areaForPath("/admin/cursos/123"), "admin");
});

test("rotas compartilhadas e públicas não pertencem a área nenhuma", () => {
  for (const path of ["/", "/entrar", "/cadastro", "/recuperar-senha", "/acesso-negado", "/curso"]) {
    assert.equal(areaForPath(path), null, path);
  }
});

test("a comparação é por segmento — /alunos-publicos não é área do aluno", () => {
  // Sem isso, um caminho só parecido cairia na área errada.
  assert.equal(areaForPath("/alunos-publicos"), null);
  assert.equal(areaForPath("/administradores"), null);
  assert.equal(areaForPath("/alunoX"), null);
});

test("query e hash não confundem a detecção de área", () => {
  assert.equal(areaForPath("/admin?tab=1"), "admin");
  assert.equal(areaForPath("/aluno/curso/x#topo"), "student");
});

/* --------------------------- permissão por role --------------------------- */

test("cada role só entra na própria área", () => {
  assert.equal(isPathAllowedForRole("/admin", "admin"), true);
  assert.equal(isPathAllowedForRole("/admin", "student"), false);
  assert.equal(isPathAllowedForRole("/aluno", "student"), true);
  assert.equal(isPathAllowedForRole("/aluno", "admin"), false);
  assert.equal(isPathAllowedForRole("/aluno/curso/x", "admin"), false);
});

test("rota compartilhada vale para as duas roles", () => {
  for (const role of ["admin", "student"] as const) {
    assert.equal(isPathAllowedForRole("/entrar", role), true, role);
    assert.equal(isPathAllowedForRole("/", role), true, role);
  }
});

/* ----------------------- destino depois de autenticar --------------------- */

test("sem next, cada role vai para a própria casa", () => {
  // Este é O defeito original: admin sem `?next` caía em /aluno.
  for (const vazio of [null, undefined, ""]) {
    assert.equal(resolvePostAuthDestination(vazio, "admin"), "/admin", String(vazio));
    assert.equal(resolvePostAuthDestination(vazio, "student"), "/aluno", String(vazio));
  }
});

test("next interno compatível com a role é preservado", () => {
  assert.equal(resolvePostAuthDestination("/admin/alunos", "admin"), "/admin/alunos");
  assert.equal(
    resolvePostAuthDestination("/aluno/curso/seu-livro", "student"),
    "/aluno/curso/seu-livro",
  );
  assert.equal(
    resolvePostAuthDestination("/aluno/aula/abc?x=1", "student"),
    "/aluno/aula/abc?x=1",
    "query string é preservada",
  );
});

test("aluno pedindo next=/admin é mandado para /aluno", () => {
  // O `?next` não pode virar uma forma de contornar a separação de áreas.
  assert.equal(resolvePostAuthDestination("/admin", "student"), "/aluno");
  assert.equal(resolvePostAuthDestination("/admin/alunos/123", "student"), "/aluno");
});

test("admin com next de rota exclusiva do aluno é mandado para /admin", () => {
  assert.equal(resolvePostAuthDestination("/aluno", "admin"), "/admin");
  assert.equal(resolvePostAuthDestination("/aluno/curso/seu-livro", "admin"), "/admin");
});

test("rota compartilhada como next é respeitada para as duas roles", () => {
  assert.equal(resolvePostAuthDestination("/termos", "admin"), "/termos");
  assert.equal(resolvePostAuthDestination("/termos", "student"), "/termos");
});

/* -------------------------- open redirect segue barrado ------------------- */

test("destino externo cai na casa da role, nunca sai do site", () => {
  const externos = [
    "https://site-malicioso.com",
    "http://site-malicioso.com/x",
    "//site-malicioso.com",
    "/\\site-malicioso.com",
    "site-malicioso.com",
    "javascript:alert(1)",
    "mailto:a@b.c",
  ];

  for (const destino of externos) {
    assert.equal(resolvePostAuthDestination(destino, "admin"), "/admin", destino);
    assert.equal(resolvePostAuthDestination(destino, "student"), "/aluno", destino);
  }
});

test("a checagem de open redirect vem ANTES da checagem de área", () => {
  // Um destino externo que "parece" da área certa não pode passar só por
  // conter o prefixo: ele nem é deste site.
  assert.equal(resolvePostAuthDestination("//evil.com/admin", "admin"), "/admin");
  assert.equal(resolvePostAuthDestination("https://evil.com/aluno", "student"), "/aluno");
});

/* ==========================================================================
   Regressão apontada pela revisão de segurança
   ==========================================================================
   /auth/callback ficou de fora da primeira rodada: resolvia o destino ANTES
   do exchangeCodeForSession, com "/aluno" fixo como padrão. Estes casos são
   os que a rota agora precisa respeitar. */

test("o destino do link de e-mail respeita a role, não um padrão fixo", () => {
  // O link de recuperação manda next=/redefinir-senha — rota compartilhada,
  // preservada para as duas roles.
  assert.equal(resolvePostAuthDestination("/redefinir-senha", "admin"), "/redefinir-senha");
  assert.equal(resolvePostAuthDestination("/redefinir-senha", "student"), "/redefinir-senha");

  // Sem next (link de confirmação de cadastro, por exemplo), cada um vai para
  // a própria casa — nunca "/aluno" para todo mundo.
  assert.equal(resolvePostAuthDestination(null, "admin"), "/admin");
  assert.equal(resolvePostAuthDestination(null, "student"), "/aluno");
});

test("travessia de diretório não engana a checagem de área", () => {
  // `/aluno/../admin` é normalizado para `/admin` ANTES da checagem de área,
  // então um aluno não alcança o painel escrevendo o caminho de outro jeito.
  assert.equal(resolvePostAuthDestination("/aluno/../admin", "student"), "/aluno");
  assert.equal(resolvePostAuthDestination("/admin/../aluno", "admin"), "/admin");
  // E o admin continua alcançando o próprio destino real.
  assert.equal(resolvePostAuthDestination("/aluno/../admin/cursos", "admin"), "/admin/cursos");
});
