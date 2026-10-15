/**
 * =============================================================================
 *  CATÁLOGO — RLS, IDOR e limites, medidos com SESSÕES REAIS
 * =============================================================================
 *
 *  Este teste não roda no CI, e é de propósito: ele precisa do banco de
 *  verdade e de credenciais reais. Rodá-lo é `npm run test:db`, com
 *  `.env.local` e `.env.admin-credentials.local` presentes.
 *
 *  O QUE ELE MEDE, E POR QUE NÃO DÁ PARA MEDIR DE OUTRO JEITO
 *  ---------------------------------------------------------------------------
 *  Toda asserção passa pela CHAVE PUBLICÁVEL e por um login de verdade — o
 *  mesmo caminho que um navegador percorre. O `service_role` aparece só para
 *  MONTAR o cenário (criar a conta descartável, plantar um rascunho) e para
 *  CONFERIR o resultado por fora; nenhuma asserção de segurança passa por ele,
 *  porque ele ignora RLS por definição e provaria exatamente nada.
 *
 *  Um teste com cliente falso também não serviria: o que está sendo verificado
 *  é a decisão do Postgres, não a do nosso código. Foi assim que se descobriu
 *  que a policy de leitura chamava `is_admin()` para o papel `anon`, que não
 *  tem EXECUTE nela — o catálogo público inteiro respondia 42501, e nenhum
 *  teste unitário veria isso.
 *
 *  SEGURANÇA DO PRÓPRIO TESTE
 *  ---------------------------------------------------------------------------
 *  - a conta criada é descartável e removida no fim;
 *  - o administrador REAL é usado para ler e para editar só o rascunho de
 *    teste — nenhum dos seis livros do cliente é alterado;
 *  - toda escrita de teste acontece em linhas criadas aqui, com slug prefixado
 *    por `zz-`, e o `finally` remove tudo, inclusive em caso de erro.
 * =========================================================================== */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ler = (arquivo) =>
  Object.fromEntries(
    readFileSync(arquivo, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );

const env = ler(".env.local");
const cred = ler(".env.admin-credentials.local");

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "OK   " : "FALHA"} ${label}${extra ? `  → ${extra}` : ""}`);
};

const stamp = String(Date.now()).slice(-8);
const aluno = { email: `zzcat${stamp}@bmaxy-teste.dev`, senha: `Cat-${stamp}-Aa1`, id: null };

let rascunhoId = null;
const criadosPeloTeste = [];
const objetosEnviados = [];

try {
  const { data: novo, error: e0 } = await admin.auth.admin.createUser({
    email: aluno.email,
    password: aluno.senha,
    email_confirm: true,
    user_metadata: { full_name: "Catalogo QA" },
  });
  if (e0) throw e0;
  aluno.id = novo.user.id;
  await admin.from("profiles").update({ must_change_password: false }).eq("id", aluno.id);

  // Um rascunho, plantado pelo service_role, para medir a visibilidade dele.
  const { data: rascunho, error: e1 } = await admin
    .from("books")
    .insert({
      slug: `zz-rascunho-${stamp}`,
      title: "Rascunho de teste",
      status: "draft",
      order_index: 900,
      print_price_cents: 1234,
    })
    .select("id")
    .single();
  if (e1) throw e1;
  rascunhoId = rascunho.id;
  criadosPeloTeste.push(rascunhoId);

  await admin.from("book_localizations").insert({
    book_id: rascunhoId,
    locale: "pt",
    synopsis: "SINOPSE SECRETA QUE NAO PODE VAZAR",
    cover_alt: "x",
  });
  await admin.from("book_store_links").insert({
    book_id: rascunhoId,
    store: "amazon",
    url: "https://www.amazon.com/dp/ZZTESTE000",
  });

  const sessao = async (email, senha) => {
    const cli = anonClient();
    const { error } = await cli.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(`login: ${error.message}`);
    return cli;
  };
  const anonimo = anonClient();
  const sAluno = await sessao(aluno.email, aluno.senha);
  const sAdmin = await sessao(cred.BMAXY_ADMIN_EMAIL, cred.BMAXY_ADMIN_PASSWORD);

  console.log("\n1. Visitante anônimo — lê publicado, e só\n");

  const { data: pub, error: ePub } = await anonimo
    .from("books")
    .select("slug")
    .eq("status", "published");

  /* REGRESSÃO. A primeira versão da policy dizia
     `using (status = 'published' or (select public.is_admin()))` para
     `anon, authenticated`. O `anon` não tem EXECUTE em `is_admin()`, então a
     consulta inteira abortava com 42501 e a vitrine ficava sem livro nenhum.
     Um erro aqui não pode ser confundido com lista vazia. */
  check(!ePub, "a leitura anônima não dá erro (não chama is_admin)", ePub?.code ?? "sem erro");
  check((pub?.length ?? 0) === 6, "anon lê os 6 livros publicados", `${pub?.length}`);

  const { data: rasc } = await anonimo.from("books").select("*").eq("id", rascunhoId);
  check((rasc?.length ?? 0) === 0, "anon NÃO vê o rascunho nem pelo id", `${rasc?.length} linhas`);

  const { data: sinRasc } = await anonimo
    .from("book_localizations")
    .select("synopsis")
    .eq("book_id", rascunhoId);
  check(
    (sinRasc?.length ?? 0) === 0,
    "anon NÃO lê a sinopse do rascunho (tabela filha espelha o pai)",
    `${sinRasc?.length} linhas`,
  );

  const { data: lnkRasc } = await anonimo
    .from("book_store_links")
    .select("url")
    .eq("book_id", rascunhoId);
  check((lnkRasc?.length ?? 0) === 0, "anon NÃO lê os links do rascunho", `${lnkRasc?.length}`);

  const { data: cot } = await anonimo.from("catalog_settings").select("brl_per_usd");
  check((cot?.length ?? 0) === 1, "anon lê a cotação (ela aparece no preço em inglês)");

  const { data: cotTexto } = await anonimo
    .from("catalog_settings")
    .select("brl_per_usd::text")
    .maybeSingle();
  check(
    typeof cotTexto?.brl_per_usd === "string",
    "a cotação sai como TEXTO com o cast (sem passar por float)",
    JSON.stringify(cotTexto?.brl_per_usd),
  );

  console.log("\n2. Visitante anônimo NÃO escreve\n");

  const { error: e2 } = await anonimo
    .from("books")
    .insert({ slug: `zz-anon-${stamp}`, title: "Invasao" });
  check(Boolean(e2), "anon não cria livro", e2?.code ?? "ACEITOU");

  const { error: e3 } = await anonimo
    .from("books")
    .update({ title: "Invadido" })
    .eq("slug", "aaron-tucker");
  const { data: intacto } = await admin
    .from("books")
    .select("title")
    .eq("slug", "aaron-tucker")
    .single();
  check(intacto?.title === "Aaron Tucker", "anon não altera livro", e3 ? `recusado: ${e3.code}` : "");

  const { error: e4 } = await anonimo
    .from("catalog_settings")
    .update({ brl_per_usd: 99 })
    .eq("id", true);
  const { data: cotIntacta } = await admin.from("catalog_settings").select("brl_per_usd").single();
  check(
    Number(cotIntacta?.brl_per_usd) === 5.1,
    "anon não altera a cotação",
    e4 ? `recusado: ${e4.code}` : `cotação=${cotIntacta?.brl_per_usd}`,
  );

  console.log("\n3. Aluno logado é público para efeito de catálogo\n");

  const { data: alunoRasc } = await sAluno.from("books").select("*").eq("id", rascunhoId);
  check((alunoRasc?.length ?? 0) === 0, "aluno NÃO vê rascunho", `${alunoRasc?.length}`);

  const { error: e5 } = await sAluno
    .from("books")
    .update({ title: "Aluno editou" })
    .eq("slug", "aaron-tucker");
  const { data: intacto2 } = await admin
    .from("books")
    .select("title")
    .eq("slug", "aaron-tucker")
    .single();
  check(
    intacto2?.title === "Aaron Tucker",
    "aluno NÃO edita livro",
    e5 ? `recusado: ${e5.code}` : "sem erro, mas título intacto",
  );

  const { error: e6 } = await sAluno.from("books").delete().eq("slug", "aaron-tucker");
  const { count: aindaSeis } = await admin
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  check(aindaSeis === 6, "aluno NÃO apaga livro", e6 ? `recusado: ${e6.code}` : "");

  const { error: e7 } = await sAluno
    .from("books")
    .update({ status: "archived" })
    .eq("slug", "aaron-tucker");
  const { data: st } = await admin
    .from("books")
    .select("status")
    .eq("slug", "aaron-tucker")
    .single();
  check(st?.status === "published", "aluno NÃO arquiva livro", e7 ? `recusado: ${e7.code}` : "");

  console.log("\n4. IDOR: trocar o id do livro não ajuda\n");

  /* O aluno tem o UUID do rascunho em mãos (veio do service_role neste teste;
     na vida real viria de um vazamento qualquer). Nenhuma das operações abaixo
     pode funcionar por conhecer o id. */
  const { error: e8 } = await sAluno
    .from("book_localizations")
    .update({ synopsis: "reescrito" })
    .eq("book_id", rascunhoId);
  const { data: sinIntacta } = await admin
    .from("book_localizations")
    .select("synopsis")
    .eq("book_id", rascunhoId)
    .eq("locale", "pt")
    .single();
  check(
    sinIntacta?.synopsis === "SINOPSE SECRETA QUE NAO PODE VAZAR",
    "aluno com o UUID não reescreve a sinopse",
    e8 ? `recusado: ${e8.code}` : "",
  );

  const { error: e9 } = await sAluno.from("book_store_links").insert({
    book_id: rascunhoId,
    store: "clube_de_autores",
    url: "https://clubedeautores.com.br/livro/invasao",
  });
  check(Boolean(e9), "aluno com o UUID não injeta link de loja", e9?.code ?? "ACEITOU");

  console.log("\n5. As funções do painel também exigem administrador\n");

  const { error: e17 } = await sAluno.rpc("create_book", {
    p_slug: `zz-aluno-${stamp}`,
    p_title: "Criado por aluno",
  });
  const { data: naoCriado } = await admin.from("books").select("id").eq("slug", `zz-aluno-${stamp}`);
  check(
    Boolean(e17) && (naoCriado?.length ?? 0) === 0,
    "aluno não cria livro por create_book()",
    e17?.code ?? "ACEITOU",
  );

  const { data: ordemAntes } = await admin
    .from("books")
    .select("slug, order_index")
    .eq("status", "published")
    .order("order_index");

  const primeiroId = (
    await admin.from("books").select("id").eq("slug", ordemAntes[0].slug).single()
  ).data.id;
  const segundoId = (
    await admin.from("books").select("id").eq("slug", ordemAntes[1].slug).single()
  ).data.id;

  const { error: e18 } = await sAluno.rpc("move_book", {
    p_book_id: segundoId,
    p_direction: "up",
  });
  const { data: ordemDepoisAluno } = await admin
    .from("books")
    .select("slug")
    .eq("status", "published")
    .order("order_index");
  check(
    Boolean(e18) && ordemDepoisAluno[0].slug === ordemAntes[0].slug,
    "aluno não reordena por move_book()",
    e18?.code ?? "ACEITOU",
  );

  console.log("\n6. Administrador enxerga e escreve\n");

  const { data: admTodos } = await sAdmin.from("books").select("slug, status");
  check(
    (admTodos?.length ?? 0) === 7,
    "admin vê os 6 publicados + o rascunho",
    `${admTodos?.length}`,
  );

  const { data: admSin } = await sAdmin
    .from("book_localizations")
    .select("synopsis")
    .eq("book_id", rascunhoId);
  check((admSin?.length ?? 0) === 1, "admin lê a sinopse do rascunho");

  const { error: e10 } = await sAdmin
    .from("books")
    .update({ title: "Rascunho de teste editado" })
    .eq("id", rascunhoId);
  check(!e10, "admin edita livro", e10?.message ?? "ok");

  /* create_book cria o livro E as duas localizações no mesmo comando. Se
     criasse só o livro, ele sumiria da vitrine de um idioma sem aviso. */
  const { data: novoId, error: e19 } = await sAdmin.rpc("create_book", {
    p_slug: `zz-novo-${stamp}`,
    p_title: "Livro criado no teste",
  });
  if (!e19 && novoId) criadosPeloTeste.push(novoId);
  const { data: locsNovo } = await admin
    .from("book_localizations")
    .select("locale")
    .eq("book_id", novoId ?? "00000000-0000-0000-0000-000000000000");
  check(!e19 && Boolean(novoId), "admin cria livro por create_book()", e19?.message ?? "ok");
  check(
    (locsNovo?.length ?? 0) === 2,
    "o livro nasce com as DUAS localizações",
    `${locsNovo?.length}`,
  );

  const { data: statusNovo } = await admin
    .from("books")
    .select("status, order_index")
    .eq("id", novoId)
    .single();
  check(statusNovo?.status === "draft", "o livro nasce como rascunho", statusNovo?.status);

  const { error: e20 } = await sAdmin.rpc("create_book", {
    p_slug: "aaron-tucker",
    p_title: "Slug repetido",
  });
  check(e20?.code === "23505", "create_book recusa slug duplicado", e20?.code ?? "ACEITOU");

  console.log("\n7. Reordenação\n");

  const { data: moveu, error: e21 } = await sAdmin.rpc("move_book", {
    p_book_id: segundoId,
    p_direction: "up",
  });
  const { data: ordemDepois } = await admin
    .from("books")
    .select("slug")
    .eq("status", "published")
    .order("order_index");
  check(
    !e21 && moveu === true && ordemDepois[0].slug === ordemAntes[1].slug,
    "admin sobe um livro e a ordem troca de fato",
    `${ordemAntes[0].slug} ⇄ ${ordemAntes[1].slug}`,
  );

  // Devolve ao lugar. Nenhum livro do cliente pode terminar o teste fora de ordem.
  await sAdmin.rpc("move_book", { p_book_id: segundoId, p_direction: "down" });
  const { data: ordemRestaurada } = await admin
    .from("books")
    .select("slug")
    .eq("status", "published")
    .order("order_index");
  check(
    ordemRestaurada.map((b) => b.slug).join() === ordemAntes.map((b) => b.slug).join(),
    "a ordem original é restaurada ao fim do teste",
  );

  const { data: naBorda } = await sAdmin.rpc("move_book", {
    p_book_id: primeiroId,
    p_direction: "up",
  });
  check(naBorda === false, "subir o primeiro devolve false, não erro", `${naBorda}`);

  const { error: e22 } = await sAdmin.rpc("move_book", {
    p_book_id: primeiroId,
    p_direction: "sideways",
  });
  check(Boolean(e22), "direção inválida é recusada", e22?.code ?? "ACEITOU");

  console.log("\n8. Capas: o bucket é quem decide\n");

  const png = new Blob([Buffer.from("89504e470d0a1a0a0000000d49484452", "hex")], {
    type: "image/png",
  });

  const { error: e23 } = await sAluno.storage
    .from("book-covers")
    .upload(`capas/zz-aluno-${stamp}.png`, png, { contentType: "image/png" });
  check(Boolean(e23), "aluno não envia capa", e23?.message ?? "ACEITOU");

  const caminhoOk = `capas/zz-teste-${stamp}.png`;
  const { error: e24 } = await sAdmin.storage
    .from("book-covers")
    .upload(caminhoOk, png, { contentType: "image/png" });
  if (!e24) objetosEnviados.push(caminhoOk);
  check(!e24, "admin envia PNG", e24?.message ?? "ok");

  /* SVG é XML: aceita <script> e executaria no contexto do site. A recusa vem
     de `allowed_mime_types` no bucket, não de validação no navegador — é por
     isso que o teste sobe direto pelo storage, sem passar pela nossa action. */
  const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], {
    type: "image/svg+xml",
  });
  const { error: e25 } = await sAdmin.storage
    .from("book-covers")
    .upload(`capas/zz-svg-${stamp}.svg`, svg, { contentType: "image/svg+xml" });
  check(Boolean(e25), "SVG é recusado pelo bucket, mesmo vindo do admin", e25?.message ?? "ACEITOU");

  const grande = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: "image/png" });
  const { error: e26 } = await sAdmin.storage
    .from("book-covers")
    .upload(`capas/zz-grande-${stamp}.png`, grande, { contentType: "image/png" });
  check(Boolean(e26), "arquivo acima de 5 MB é recusado", e26?.message ?? "ACEITOU");

  console.log("\n9. Os limites do banco valem para o administrador também\n");

  const { error: e11 } = await sAdmin
    .from("book_store_links")
    .update({ url: "http://www.amazon.com/dp/X" })
    .eq("book_id", rascunhoId)
    .eq("store", "amazon");
  check(Boolean(e11), "link http:// é recusado", e11?.code ?? "ACEITOU");

  const { error: e12 } = await sAdmin
    .from("book_store_links")
    .update({ url: "https://site-malicioso.com/livro" })
    .eq("book_id", rascunhoId)
    .eq("store", "amazon");
  check(Boolean(e12), "domínio fora da allowlist é recusado", e12?.code ?? "ACEITOU");

  /* O caso que uma comparação por `includes("amazon.com")` deixaria passar. */
  const { error: e27 } = await sAdmin
    .from("book_store_links")
    .update({ url: "https://amazon.com.invasor.net/dp/X" })
    .eq("book_id", rascunhoId)
    .eq("store", "amazon");
  check(Boolean(e27), "domínio que só COMEÇA com amazon.com é recusado", e27?.code ?? "ACEITOU");

  const { error: e13 } = await sAdmin
    .from("books")
    .update({ slug: "Slug Invalido!" })
    .eq("id", rascunhoId);
  check(Boolean(e13), "slug fora do formato é recusado", e13?.code ?? "ACEITOU");

  const { error: e14 } = await sAdmin
    .from("books")
    .update({ slug: "aaron-tucker" })
    .eq("id", rascunhoId);
  check(Boolean(e14), "slug duplicado é recusado", e14?.code ?? "ACEITOU");

  const { error: e15 } = await sAdmin
    .from("books")
    .update({ print_price_cents: -100 })
    .eq("id", rascunhoId);
  check(Boolean(e15), "preço negativo é recusado", e15?.code ?? "ACEITOU");

  const { error: e16 } = await sAdmin.from("catalog_settings").insert({ id: false, brl_per_usd: 1 });
  check(Boolean(e16), "segunda linha de cotação é recusada (singleton)", e16?.code ?? "ACEITOU");

  const { error: e28 } = await sAdmin
    .from("catalog_settings")
    .update({ brl_per_usd: 0 })
    .eq("id", true);
  check(Boolean(e28), "cotação zero é recusada", e28?.code ?? "ACEITOU");
} catch (erro) {
  fail++;
  console.log(`\n  ERRO: ${erro.message}`);
} finally {
  console.log("");

  for (const id of criadosPeloTeste) {
    await admin.from("books").delete().eq("id", id);
  }
  if (criadosPeloTeste.length) console.log(`  ${criadosPeloTeste.length} livro(s) de teste removido(s)`);

  if (objetosEnviados.length) {
    await admin.storage.from("book-covers").remove(objetosEnviados);
    console.log(`  ${objetosEnviados.length} capa(s) de teste removida(s)`);
  }

  if (aluno.id) {
    await admin.auth.admin.deleteUser(aluno.id);
    console.log("  conta descartável removida");
  }

  const { data: restam } = await admin
    .from("books")
    .select("slug, order_index")
    .order("order_index");
  console.log(`  livros no banco: ${restam?.length} → ${restam?.map((b) => b.slug).join(", ")}`);
  console.log(`\n=== ${pass} ok, ${fail} falha(s) ===`);
}

process.exit(fail === 0 ? 0 : 1);
