import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * =============================================================================
 *  A TRAVA QUE IMPEDE UMA VITRINE VAZIA DE IR AO AR
 * =============================================================================
 *
 *  O comportamento protegido aqui foi MEDIDO, não deduzido:
 *
 *    1. `next build` com o Supabase inacessível gera `/livros` sem livro
 *       nenhum, porque a leitura falha e o build segue em frente;
 *    2. o banco volta e o servidor sobe normalmente;
 *    3. cinco requisições seguidas a `/livros` devolvem ZERO livros nas cinco.
 *
 *  `revalidate = 3600` não socorre: ele declara a página FRESCA por uma hora.
 *  O resultado seria uma loja sem produtos, sem erro em lugar nenhum, por até
 *  sessenta minutos.
 *
 *  `CATALOGO_OBRIGATORIO=1` fecha a porta: a leitura é tentada três vezes e,
 *  se ainda falhar, o build falha. Build que falha não publica nada.
 *
 *  ---------------------------------------------------------------------------
 *  POR QUE ESTE TESTE LÊ O CÓDIGO-FONTE
 *  ---------------------------------------------------------------------------
 *
 *  Não dá para exercitar o caminho de verdade num teste unitário: ele só
 *  existe dentro de um `next build`, com `unstable_cache` e `NEXT_PHASE`
 *  reais. Rodar um build de verdade aqui levaria minutos e precisaria derrubar
 *  a rede.
 *
 *  O que este arquivo garante é mais modesto e ainda vale: que a trava não
 *  seja REMOVIDA sem querer. Se alguém apagar a checagem de
 *  `CATALOGO_OBRIGATORIO`, ou trocar o `throw` por um `console.warn` numa
 *  limpeza de código, o teste quebra e explica o que estava em jogo.
 *
 *  A verificação de comportamento de ponta a ponta está no relatório da
 *  entrega e é reproduzível com os três cenários descritos em
 *  `docs/DEPLOY-ROLLBACK.md`.
 * =========================================================================== */

const DAL = readFileSync("src/lib/dal/catalog.ts", "utf8");

test("a trava de build existe e é lida do ambiente", () => {
  assert.match(
    DAL,
    /const CATALOGO_OBRIGATORIO = process\.env\.CATALOGO_OBRIGATORIO === "1"/,
    "a variável que impede publicar catálogo vazio sumiu de src/lib/dal/catalog.ts",
  );
});

test("com a trava ligada, a falha de leitura estoura mesmo durante o build", () => {
  /* A condição precisa ser exatamente esta: fora do build SEMPRE estoura, e
     durante o build estoura quando a trava está ligada. Um `&&` no lugar do
     `||`, ou a ausência de `CATALOGO_OBRIGATORIO` na condição, devolveria o
     comportamento antigo — o que publica a vitrine vazia. */
  assert.match(
    DAL,
    /if \(!DURANTE_O_BUILD \|\| CATALOGO_OBRIGATORIO\) throw erro;/,
    "a condição que decide entre falhar o build e seguir vazio foi alterada",
  );
});

test("o build tenta mais de uma vez antes de desistir", () => {
  /* Sem repetição, a trava viraria um estorvo: uma oscilação de rede de dois
     segundos derrubaria um deploy legítimo. Com ela, custa duas tentativas. */
  assert.match(DAL, /const tentativas = DURANTE_O_BUILD \? 3 : 1;/);

  /* E em tempo de requisição NÃO se repete: há um visitante esperando, e três
     tentativas transformariam um erro rápido numa espera longa que termina em
     erro do mesmo jeito. */
  assert.ok(
    DAL.includes("DURANTE_O_BUILD ? 3 : 1"),
    "a repetição deixou de ser exclusiva do build",
  );
});

test("as quatro rotas públicas do catálogo têm rede de segurança de revalidação", () => {
  /* Cobre o caso que a trava não cobre: alguém alterar um livro direto no
     banco, sem passar pelo painel. Sem `revalidate`, a vitrine só mudaria no
     próximo deploy. */
  for (const rota of [
    "src/app/(pt)/livros/page.tsx",
    "src/app/(pt)/livros/[slug]/page.tsx",
    "src/app/en/books/page.tsx",
    "src/app/en/books/[slug]/page.tsx",
  ]) {
    assert.match(
      readFileSync(rota, "utf8"),
      /export const revalidate = \d+;/,
      `${rota} ficou sem revalidate`,
    );
  }
});

test("a produção é instruída a ligar a trava", () => {
  /* A trava só serve se estiver ligada onde importa. Se a instrução sumir da
     documentação, alguém configurará a Vercel sem ela e o risco volta
     inteiro — sem nenhum sinal de que voltou. */
  const deploy = readFileSync("docs/DEPLOY-ROLLBACK.md", "utf8");
  assert.match(deploy, /CATALOGO_OBRIGATORIO=1/);
  assert.match(deploy, /obrigatória em Production/i);

  const exemplo = readFileSync(".env.example", "utf8");
  assert.match(exemplo, /^CATALOGO_OBRIGATORIO=/m);
});
