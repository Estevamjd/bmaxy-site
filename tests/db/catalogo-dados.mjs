/**
 * =============================================================================
 *  CATÁLOGO — os invariantes do CONTEÚDO, agora contra o banco
 * =============================================================================
 *
 *  Estas asserções viviam em `tests/content.test.mts` e conferiam a lista de
 *  livros que estava em `src/content/site.ts`. Elas não foram descartadas na
 *  migração: MUDARAM DE LUGAR junto com o dado. Continuar conferindo o arquivo
 *  seria validar uma cópia que nenhuma página lê mais.
 *
 *  Tudo aqui é SOMENTE LEITURA, e pela chave publicável — é literalmente o que
 *  a vitrine enxerga. Nenhuma linha é criada, alterada ou removida.
 *
 *  Roda com `npm run test:db`, fora do CI, porque precisa do banco real.
 * =========================================================================== */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "OK   " : "FALHA"} ${label}${extra ? `  → ${extra}` : ""}`);
};

const { data: livros, error } = await sb
  .from("books")
  .select(
    `slug, title, order_index, print_price_cents, ebook_price_cents,
     cover_path, cover_width, cover_height,
     book_localizations ( locale, synopsis, cover_alt ),
     book_store_links ( store, url )`,
  )
  .eq("status", "published")
  .order("order_index", { ascending: true });

if (error) {
  console.log(`  ERRO ao ler o catálogo: ${error.code} ${error.message}`);
  process.exit(1);
}

console.log("\n1. O catálogo publicado\n");

check(livros.length === 6, "seis livros publicados", `${livros.length}`);

const ordens = livros.map((l) => l.order_index);
check(
  ordens.every((o, i) => o === ordens[i]) && new Set(ordens).size === ordens.length,
  "a ordem não tem repetição",
  ordens.join(", "),
);
check(
  ordens.every((o, i) => i === 0 || o > ordens[i - 1]),
  "a ordem é estritamente crescente",
  ordens.join(", "),
);

console.log("\n2. Cada livro está completo nos dois idiomas\n");

for (const livro of livros) {
  const pt = livro.book_localizations.find((l) => l.locale === "pt");
  const en = livro.book_localizations.find((l) => l.locale === "en");

  check(Boolean(pt) && Boolean(en), `${livro.slug}: tem as duas localizações`);

  /* Sem sinopse, o card aparece vazio na vitrine daquele idioma — e como o
     join é à esquerda, isso NÃO faz o livro sumir; ele fica lá, mudo. É
     exatamente o tipo de falha que só um teste percebe. */
  check(
    (pt?.synopsis ?? "").trim().length > 0 && (en?.synopsis ?? "").trim().length > 0,
    `${livro.slug}: sinopse preenchida em pt e en`,
    `pt=${pt?.synopsis?.length ?? 0} en=${en?.synopsis?.length ?? 0}`,
  );

  /* Texto alternativo é acessibilidade, não enfeite: sem ele, quem usa leitor
     de tela recebe "imagem" e nada mais. */
  check(
    (pt?.cover_alt ?? "").trim().length > 0 && (en?.cover_alt ?? "").trim().length > 0,
    `${livro.slug}: capa descrita em pt e en`,
  );

  check(livro.title.trim().length > 0, `${livro.slug}: tem título`);
  check(livro.cover_path.trim().length > 0, `${livro.slug}: tem capa`, livro.cover_path);
}

console.log("\n3. Links de loja\n");

for (const livro of livros) {
  for (const link of livro.book_store_links) {
    check(
      link.url.startsWith("https://"),
      `${livro.slug}/${link.store}: https`,
      link.url.slice(0, 48),
    );

    const host = new URL(link.url).hostname.toLowerCase();
    const esperado =
      link.store === "amazon"
        ? ["amazon.com", "amazon.com.br"]
        : ["clubedeautores.com.br"];

    check(
      esperado.some((d) => host === d || host.endsWith(`.${d}`)),
      `${livro.slug}/${link.store}: aponta para a loja certa`,
      host,
    );
  }
}

console.log("\n4. Preços\n");

for (const livro of livros) {
  for (const [rotulo, centavos] of [
    ["impresso", livro.print_price_cents],
    ["ebook", livro.ebook_price_cents],
  ]) {
    if (centavos === null) continue;

    /* Preço é INTEIRO de centavos. Se algum dia alguém gravar reais nesta
       coluna, R$ 73,92 viraria 73 centavos e ninguém notaria até um cliente
       reclamar. */
    check(
      Number.isInteger(centavos) && centavos > 0,
      `${livro.slug}/${rotulo}: centavos inteiros e positivos`,
      String(centavos),
    );
  }
}

const semPreco = livros.filter((l) => l.print_price_cents === null && l.ebook_price_cents === null);
check(
  semPreco.length === 1 && semPreco[0].slug === "respeito-de-daniel",
  "só respeito-de-daniel segue sem preço confirmado",
  semPreco.map((l) => l.slug).join(", ") || "nenhum",
);

console.log("\n5. Cotação\n");

const { data: cot } = await sb.from("catalog_settings").select("brl_per_usd::text").maybeSingle();
check(
  typeof cot?.brl_per_usd === "string" && /^\d+\.\d{4}$/.test(cot.brl_per_usd),
  "a cotação é lida como texto decimal exato",
  JSON.stringify(cot?.brl_per_usd),
);

console.log(`\n=== ${pass} ok, ${fail} falha(s) ===`);
process.exit(fail === 0 ? 0 : 1);
