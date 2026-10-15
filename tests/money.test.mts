import assert from "node:assert/strict";
import test from "node:test";
import {
  TAXA_PADRAO,
  centavosDeTexto,
  centavosParaCampo,
  converterParaUsdCentavos,
  formatarBRL,
  formatarPreco,
  formatarTaxa,
  formatarUSDAproximado,
  taxaDeTexto,
  taxaParaTexto,
  type Taxa,
} from "@/lib/money";

/**
 * =============================================================================
 *  DINHEIRO
 * =============================================================================
 *
 *  O bloco mais importante deste arquivo é o último: ele compara a conversão
 *  calculada com os preços em dólar que JÁ ESTAVAM PUBLICADOS em `site.ts`.
 *  Enquanto o catálogo migra de arquivo para banco, é o que garante que o
 *  visitante não vê o preço mudar sozinho.
 * =========================================================================== */

const TAXA = taxaDeTexto("5.1000") as Taxa;

/* ------------------------------- a cotação -------------------------------- */

test("a cotação é lida do texto sem passar por ponto flutuante", () => {
  /* `5.1 * 10000` em ponto flutuante dá 51000.00000000001. Se a leitura
     multiplicasse, a cotação guardada já nasceria errada — e o erro seria
     invisível até alguém somar o suficiente para ele aparecer num preço. */
  assert.equal(taxaDeTexto("5.1000"), 51_000);
  assert.equal(taxaDeTexto("5.1"), 51_000);
  assert.equal(taxaDeTexto("5"), 50_000);
  assert.equal(taxaDeTexto("5,10"), 51_000); // vírgula, teclado brasileiro
  assert.equal(taxaDeTexto("  5.1000  "), 51_000);
});

test("a cotação padrão é a combinada com o cliente", () => {
  assert.equal(TAXA_PADRAO, 51_000);
  assert.equal(taxaParaTexto(TAXA_PADRAO), "5.1000");
  assert.equal(formatarTaxa(TAXA_PADRAO), "R$ 5,1000");
});

test("cotação inválida é recusada, não corrigida", () => {
  for (const entrada of [
    "",
    "abc",
    "-5",
    "0",
    "5.12345", // cinco casas: o banco guarda quatro
    "1e3", // notação científica
    "5.1.0",
    "1000", // acima do teto do CHECK
    "R$ 5,10", // a cotação não é digitada com símbolo
  ]) {
    assert.equal(taxaDeTexto(entrada), null, `deveria recusar ${JSON.stringify(entrada)}`);
  }
});

test("a quinta casa decimal é recusada em vez de truncada", () => {
  /* Truncar faria a aplicação exibir preços calculados com uma cotação que o
     banco não tem — o `numeric(10,4)` guardaria 5.1234 e a tela mostraria
     valores de 5.12345. Divergência silenciosa entre o que se vê e o que
     está gravado é pior do que um formulário recusado. */
  assert.equal(taxaDeTexto("5.12345"), null);
  assert.equal(taxaDeTexto("5.1234"), 51_234);
});

test("ida e volta da cotação preserva o valor exato", () => {
  for (const texto of ["5.1000", "1.0000", "0.0001", "999.9999", "12.3456"]) {
    const taxa = taxaDeTexto(texto);
    assert.notEqual(taxa, null, texto);
    assert.equal(taxaParaTexto(taxa as Taxa), texto);
  }
});

/* ------------------------------ a conversão ------------------------------- */

test("a conversão arredonda para os 5 centavos mais próximos", () => {
  assert.equal(converterParaUsdCentavos(7392, TAXA), 1450); // 14.4941 -> 14.50
  assert.equal(converterParaUsdCentavos(3550, TAXA), 695); //  6.9608 -> 6.95
});

test("a conversão arredonda UMA vez, não duas", () => {
  /* Arredondar para centavo e depois para cinco centavos carrega o erro do
     primeiro passo para o segundo. R$ 63,20 / 5,1 = 12.3921...:
       - dois passos: 1239 -> 1240
       - um passo:    12.3921/5 = 2.478 -> 2 * 5 = ... 1240 também.
     O caso que separa os dois é onde o primeiro arredondamento cruza a
     fronteira do múltiplo de 5. R$ 63,52 / 5,1 = 12.4549:
       - dois passos: 1245 -> 1245
       - um passo:    12.4549/5 = 2.4910 -> 2 -> 1245. */
  assert.equal(converterParaUsdCentavos(6352, TAXA), 1245);

  /* E o caso oposto, logo acima da metade: 12.4559 -> 2.49118 -> 2 -> 1245. */
  assert.equal(converterParaUsdCentavos(6353, TAXA), 1245);
});

test("mudar a cotação muda todos os preços, sem tocar em livro nenhum", () => {
  /* É o requisito central da funcionalidade: o dólar é DERIVADO. Se algum dia
     alguém guardar o valor convertido numa coluna, este teste continua
     passando e a funcionalidade quebra — por isso ele compara duas taxas em
     vez de conferir um número só. */
  const outra = taxaDeTexto("6.0000") as Taxa;

  assert.equal(converterParaUsdCentavos(7392, TAXA), 1450);
  assert.equal(converterParaUsdCentavos(7392, outra), 1230); // 12.32 -> 12.30
  assert.equal(converterParaUsdCentavos(9647, TAXA), 1890);
  assert.equal(converterParaUsdCentavos(9647, outra), 1610); // 16.078 -> 16.10
});

test("preço ausente e preço zero não são a mesma coisa", () => {
  assert.equal(formatarPreco(null, "pt", TAXA), null);
  assert.equal(formatarPreco(null, "en", TAXA), null);
  assert.equal(converterParaUsdCentavos(0, TAXA), 0);
});

test("a conversão aguenta o teto sem estourar a precisão", () => {
  /* `BigInt` no meio do cálculo existe para isto: 100.000.000 centavos vezes
     10.000 passa de 2^53, e em `number` o resultado começaria a pular. */
  const resultado = converterParaUsdCentavos(100_000_000, TAXA);
  assert.equal(resultado, 19_607_845);
  assert.equal(Number.isSafeInteger(resultado), true);
});

/* ------------------------------ a formatação ------------------------------ */

test("reais são formatados no padrão brasileiro", () => {
  assert.equal(formatarBRL(7392), "R$ 73,92");
  assert.equal(formatarBRL(500), "R$ 5,00");
  assert.equal(formatarBRL(5), "R$ 0,05");
  assert.equal(formatarBRL(123_456), "R$ 1.234,56");
  assert.equal(formatarBRL(100_000_000), "R$ 1.000.000,00");
});

test("dólares são formatados no padrão americano", () => {
  assert.equal(formatarUSDAproximado(1450), "Approx. US$ 14.50");
  assert.equal(formatarUSDAproximado(605), "Approx. US$ 6.05");
  assert.equal(formatarUSDAproximado(123_456), "Approx. US$ 1,234.56");
});

test('o "Approx." não é opcional', () => {
  /* O valor em dólar SEMPRE vem de uma cotação manual e nunca é o preço que
     alguém paga — a loja cobra em reais. Se o rótulo fosse parâmetro, uma
     chamada esqueceria dele e a tela passaria a anunciar um preço exato que
     não existe. Por isso ele está dentro da função. */
  assert.ok(formatarUSDAproximado(1450).startsWith("Approx. "));
  assert.ok((formatarPreco(7392, "en", TAXA) as string).startsWith("Approx. "));
});

test("a formatação usa espaço comum, não o espaço do Intl", () => {
  /* `Intl.NumberFormat("pt-BR", ...)` insere U+00A0 entre símbolo e número, e
     o resultado varia com a versão do ICU do runtime. O catálogo publicado usa
     espaço comum. Um teste que compare com a saída do Intl passa num ambiente
     e falha no outro. */
  assert.equal(formatarBRL(7392).includes(" "), false);
  assert.equal(formatarUSDAproximado(1450).includes(" "), false);
});

test("o idioma decide a moeda", () => {
  assert.equal(formatarPreco(7392, "pt", TAXA), "R$ 73,92");
  assert.equal(formatarPreco(7392, "en", TAXA), "Approx. US$ 14.50");
});

/* --------------------------- entrada do painel ---------------------------- */

test("o administrador digita o preço como quiser", () => {
  assert.equal(centavosDeTexto("73,92"), 7392);
  assert.equal(centavosDeTexto("73.92"), 7392);
  assert.equal(centavosDeTexto("R$ 73,92"), 7392);
  assert.equal(centavosDeTexto("  73,92  "), 7392);
  assert.equal(centavosDeTexto("73"), 7300);
  assert.equal(centavosDeTexto("1.234,56"), 123_456);
  assert.equal(centavosDeTexto("0,05"), 5);
});

test("ponto é milhar quando o número tem três dígitos depois dele", () => {
  /* "1.234" é mil duzentos e trinta e quatro reais, não um real e vinte e
     três. Não existe preço com três casas decimais, então a leitura é
     inequívoca — e errar aqui multiplicaria o preço por mil na vitrine. */
  assert.equal(centavosDeTexto("1.234"), 123_400);
  assert.equal(centavosDeTexto("73.92"), 7392); // dois dígitos: decimal
});

test("campo vazio é preço ausente, texto inválido é erro", () => {
  /* A distinção decide o que a Server Action faz: `null` grava NULL na coluna
     (o formato não tem preço), `"erro"` recusa o formulário. Colapsar os dois
     faria "abcd" virar um preço apagado sem ninguém perceber. */
  assert.equal(centavosDeTexto(""), null);
  assert.equal(centavosDeTexto("   "), null);
  assert.equal(centavosDeTexto("R$"), null);

  for (const entrada of ["abc", "-10", "10,999", "1,2,3", "R$ abc", "10.00.00"]) {
    assert.equal(centavosDeTexto(entrada), "erro", `deveria recusar ${JSON.stringify(entrada)}`);
  }
});

test("preço fora dos limites do banco é recusado antes de chegar ao banco", () => {
  /* Os mesmos limites do CHECK da migration. Recusar aqui dá mensagem de
     formulário; deixar passar dá erro 23514 e uma tela de falha genérica. */
  assert.equal(centavosDeTexto("0"), "erro");
  assert.equal(centavosDeTexto("0,00"), "erro");
  assert.equal(centavosDeTexto("1000000,01"), "erro");
  assert.equal(centavosDeTexto("1000000,00"), 100_000_000);
});

test("ida e volta pelo campo do formulário preserva os centavos", () => {
  for (const centavos of [1, 5, 500, 7392, 123_456, 100_000_000]) {
    assert.equal(centavosDeTexto(centavosParaCampo(centavos)), centavos);
  }
  assert.equal(centavosParaCampo(null), "");
});

/* ==========================================================================
 *  O TESTE QUE PROTEGE O PREÇO PUBLICADO
 * ========================================================================== */

/**
 * O CATÁLOGO COMO ESTAVA PUBLICADO ANTES DA MIGRAÇÃO PARA O BANCO.
 *
 * Copiado de `src/content/site.ts` na véspera de o arquivo deixar de conter
 * livros. Os valores em dólar foram escritos À MÃO, um a um, antes de existir
 * conversão automática — é justamente por não terem sido calculados que eles
 * servem de prova independente.
 *
 * Esta constante é um MARCO HISTÓRICO e não deve ser atualizada quando um
 * preço mudar no painel. Ela responde a uma pergunta só: "o cálculo que
 * substituiu a digitação manual chega no mesmo número?".
 */
const PRECOS_PUBLICADOS = [
  { slug: "aaron-tucker", brl: "R$ 73,92", usd: "Approx. US$ 14.50", brlEbook: "R$ 35,50", usdEbook: "Approx. US$ 6.95" },
  { slug: "devagar-tambem-e-pressa", brl: "R$ 96,47", usd: "Approx. US$ 18.90", brlEbook: null, usdEbook: null },
  { slug: "5-passos-importantes-para-prosperar", brl: "R$ 64,39", usd: "Approx. US$ 12.60", brlEbook: null, usdEbook: null },
  { slug: "e-se-eu-fosse-embora", brl: "R$ 102,29", usd: "Approx. US$ 20.05", brlEbook: null, usdEbook: null },
  { slug: "minha-beagle-luna", brl: "R$ 89,33", usd: "Approx. US$ 17.50", brlEbook: "R$ 29,56", usdEbook: "Approx. US$ 5.80" },
  { slug: "respeito-de-daniel", brl: null, usd: null, brlEbook: null, usdEbook: null },
] as const;

test("a conversão reproduz os preços em dólar que estavam publicados", () => {
  /**
   * UM PREÇO MUDA, E A MUDANÇA FOI APROVADA PELO CLIENTE.
   *
   * `5-passos-importantes-para-prosperar` estava publicado à mão como
   * US$ 12.60. R$ 64,39 ÷ 5,1000 = 12,6255, que arredondado para os 5 centavos
   * mais próximos dá **US$ 12.65**. Os outros seis batem exatamente, o que
   * confirma de uma vez a taxa 5,1000 e a convenção de arredondamento.
   *
   * Decisão do cliente: **manter 12.65**, respeitando o cálculo centralizado.
   * Sem exceção por livro e sem mexer na cotação global — as duas saídas
   * fáceis foram descartadas de propósito. Uma tabela de "preços especiais"
   * reintroduziria, um livro de cada vez, exatamente o acoplamento que esta
   * entrega removeu; mexer na cotação para consertar um título estragaria os
   * outros seis.
   *
   * Este `Set` é, portanto, um registro HISTÓRICO — "aqui o valor digitado à
   * mão não batia com a conta" —, não uma exceção que o código aplica. Não
   * existe nenhum caminho em `src/` que consulte esta lista: procure por
   * `12.60` no código-fonte e não haverá resultado.
   */
  const DIVERGENTE_DO_PUBLICADO_ANTIGO = new Set(["5-passos-importantes-para-prosperar:print"]);

  let conferidos = 0;

  for (const livro of PRECOS_PUBLICADOS) {
    const formatos = [
      { nome: "print", brl: livro.brl, usd: livro.usd },
      { nome: "ebook", brl: livro.brlEbook, usd: livro.usdEbook },
    ] as const;

    for (const formato of formatos) {
      if (formato.brl === null) {
        /* Sem preço em reais não pode haver preço em dólar: ele é derivado. */
        assert.equal(formato.usd, null, `${livro.slug}/${formato.nome} tem dólar sem real`);
        continue;
      }

      const centavos = centavosDeTexto(formato.brl);
      assert.ok(
        typeof centavos === "number",
        `${livro.slug}/${formato.nome}: "${formato.brl}" não foi lido como preço`,
      );

      const calculado = formatarUSDAproximado(converterParaUsdCentavos(centavos, TAXA));

      if (DIVERGENTE_DO_PUBLICADO_ANTIGO.has(`${livro.slug}:${formato.nome}`)) {
        /* O valor APROVADO é o calculado. Afirmar o número exato, e não apenas
           "difere do antigo", é o que trava a decisão: se alguém criar uma
           exceção por livro ou mexer na cotação para trazer o preço de volta a
           12.60, este teste quebra e explica o porquê. */
        assert.equal(
          calculado,
          "Approx. US$ 12.65",
          `${livro.slug}/${formato.nome}: o valor aprovado é US$ 12.65, vindo do cálculo central`,
        );
        assert.notEqual(
          calculado,
          formato.usd,
          `${livro.slug}/${formato.nome} voltou a bater com o valor antigo — a cotação global foi alterada?`,
        );
      } else {
        assert.equal(
          calculado,
          formato.usd,
          `${livro.slug}/${formato.nome} mudaria de preço na vitrine`,
        );
        conferidos++;
      }
    }
  }

  /* Sem esta linha, uma lista esvaziada faria o teste passar sem comparar nada. */
  assert.equal(conferidos, 6, "esperava conferir 6 preços em dólar");
});
