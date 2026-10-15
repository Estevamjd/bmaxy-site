/**
 * =============================================================================
 *  DINHEIRO — centavos inteiros, cotação exata, zero ponto flutuante
 * =============================================================================
 *
 *  Sem "server-only" de propósito: o formulário do painel formata preço
 *  enquanto o administrador digita, e ele é Client Component.
 *
 *  ---------------------------------------------------------------------------
 *  POR QUE NÃO EXISTE UM `number` DE REAIS EM LUGAR NENHUM DESTE ARQUIVO
 *  ---------------------------------------------------------------------------
 *
 *  `0.1 + 0.2 === 0.30000000000000004`. Em preço isso vira centavo que aparece
 *  e desaparece dependendo da conta. O projeto já teve um sintoma disso no
 *  sitemap, onde `0.8 - 0.1` saía como `0.7000000000000001` no XML gerado.
 *  Ali era cosmético. Em preço, não é.
 *
 *  Então:
 *    - preço é `integer` de CENTAVOS, no banco e aqui;
 *    - a cotação é `numeric(10,4)` no banco e um INTEIRO DE DÉCIMOS DE
 *      MILÉSIMO aqui (5.1 vira 51000);
 *    - a conversão é feita com `BigInt`, e o arredondamento é explícito.
 *
 *  A cotação chega do banco como TEXTO (`brl_per_usd::text`), não como número.
 *  Se ela passasse por `JSON.parse`, `5.1000` viraria o `double` mais próximo
 *  de 5.1 — que não é 5.1 — antes de este módulo ter qualquer chance de opinar.
 *  `taxaDeTexto()` é a única porta de entrada, e ela lê o decimal dígito a
 *  dígito.
 *
 *  ---------------------------------------------------------------------------
 *  O DÓLAR É APROXIMADO, E ISSO É UMA DECISÃO DE PRODUTO
 *  ---------------------------------------------------------------------------
 *
 *  O preço real é em reais: é o que a loja cobra. O valor em dólar é uma
 *  cortesia para quem lê em inglês entender a ordem de grandeza — nunca um
 *  preço que alguém vá pagar. Daí o rótulo "Approx." ser obrigatório na
 *  formatação em inglês, e não uma opção do chamador que possa ser esquecida.
 *
 *  O arredondamento para os 5 centavos mais próximos reproduz a convenção dos
 *  preços que já estavam publicados em inglês em `site.ts` (6 dos 7 batem
 *  exatamente — o sétimo está documentado no relatório da entrega).
 * =========================================================================== */

/** Menor e maior preço aceitos, em centavos. Espelha o CHECK da migration. */
export const PRECO_MINIMO_CENTAVOS = 1;
export const PRECO_MAXIMO_CENTAVOS = 100_000_000; // R$ 1.000.000,00

/** Limites da cotação, em décimos de milésimo. Espelha o CHECK da migration. */
export const TAXA_MINIMA = 1; // 0,0001
export const TAXA_MAXIMA = 10_000_000 - 1; // 999,9999

/**
 * A cotação como inteiro de décimos de milésimo. `5.1` é `51000`.
 *
 * É um tipo nomeado, e não `number` cru, porque a única forma de errar aqui é
 * passar reais-por-dólar onde se espera a escala interna. O nome no parâmetro
 * não impede; o tipo, sim.
 */
export type Taxa = number & { readonly __taxa: unique symbol };

/* -------------------------------------------------------------------------- */
/*  Cotação                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lê a cotação de um decimal em texto, sem passar por ponto flutuante.
 *
 * Aceita `"5"`, `"5.1"`, `"5.1000"`, `"5,10"`. Devolve `null` para qualquer
 * outra coisa — inclusive negativo, vazio e notação científica. Mais de quatro
 * casas decimais é recusado em vez de truncado em silêncio: o banco guarda
 * quatro, e truncar aqui faria a aplicação exibir um número que o banco não
 * tem.
 */
export function taxaDeTexto(valor: string): Taxa | null {
  const texto = valor.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(texto)) return null;

  const [inteira, decimal = ""] = texto.split(".");
  const decimalCompleta = decimal.padEnd(4, "0");

  /* Concatenação de dígitos, não multiplicação: `5.1 * 10000` em ponto
     flutuante dá 51000.00000000001, e este módulo inteiro existe para que
     números assim nunca cheguem a existir. */
  const bruto = Number(`${inteira}${decimalCompleta}`);
  if (!Number.isSafeInteger(bruto)) return null;
  if (bruto < TAXA_MINIMA || bruto > TAXA_MAXIMA) return null;

  return bruto as Taxa;
}

/** A cotação de volta em texto decimal, para gravar no `numeric` e exibir. */
export function taxaParaTexto(taxa: Taxa): string {
  const inteira = Math.trunc(taxa / 10_000);
  const decimal = String(taxa % 10_000).padStart(4, "0");
  return `${inteira}.${decimal}`;
}

/** Como o administrador lê a cotação no painel: `5,1000` → `R$ 5,1000`. */
export function formatarTaxa(taxa: Taxa): string {
  return `R$ ${taxaParaTexto(taxa).replace(".", ",")}`;
}

/** A cotação inicial combinada com o cliente, usada quando o banco não responde. */
export const TAXA_PADRAO = taxaDeTexto("5.1000") as Taxa;

/* -------------------------------------------------------------------------- */
/*  Conversão                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Reais em centavos → dólares em centavos, arredondado para os 5 centavos mais
 * próximos.
 *
 * Todo o cálculo é `BigInt`. O arredondamento acontece UMA vez, direto da
 * fração exata para o múltiplo de 5 — arredondar para centavo e depois para
 * cinco centavos arredondaria duas vezes, e o erro da primeira entraria na
 * segunda.
 *
 *     usd = brl / taxa
 *     resultado = round(usd / 5) * 5
 *               = floor((2·brl·10000 + 5·taxa) / (10·taxa)) · 5
 *
 * O `+5·taxa` no numerador é o meio-passo que transforma o `floor` da divisão
 * inteira em arredondamento para o mais próximo.
 */
export function converterParaUsdCentavos(brlCentavos: number, taxa: Taxa): number {
  if (!Number.isInteger(brlCentavos) || brlCentavos <= 0) return 0;

  const numerador = BigInt(brlCentavos) * 10_000n;
  const denominador = BigInt(taxa);
  const passos = (2n * numerador + 5n * denominador) / (10n * denominador);

  return Number(passos * 5n);
}

/* -------------------------------------------------------------------------- */
/*  Formatação                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * `Intl.NumberFormat` não é usado aqui de propósito.
 *
 * Ele insere U+00A0 (espaço não separável) entre o símbolo e o número em
 * pt-BR, e o resultado varia com a versão do ICU embutida no runtime. O
 * catálogo publicado usa espaço comum, e um teste que compara `"R$ 73,92"` com
 * a saída do Intl passa no navegador e falha no Node — ou o contrário.
 * Formatação de moeda com duas casas fixas é curta o bastante para não valer
 * essa imprevisibilidade.
 */
function agruparMilhares(digitos: string, separador: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, separador);
}

function partir(centavos: number): { inteira: string; decimal: string } {
  const absoluto = Math.abs(Math.trunc(centavos));
  return {
    inteira: String(Math.trunc(absoluto / 100)),
    decimal: String(absoluto % 100).padStart(2, "0"),
  };
}

/** `7392` → `"R$ 73,92"`. */
export function formatarBRL(centavos: number): string {
  const { inteira, decimal } = partir(centavos);
  return `R$ ${agruparMilhares(inteira, ".")},${decimal}`;
}

/**
 * `1450` → `"Approx. US$ 14.50"`.
 *
 * O "Approx." faz parte da função e não é parâmetro: o valor em dólar é SEMPRE
 * derivado de uma cotação manual, e não existe caso em que exibi-lo como preço
 * exato seja correto.
 */
export function formatarUSDAproximado(centavos: number): string {
  const { inteira, decimal } = partir(centavos);
  return `Approx. US$ ${agruparMilhares(inteira, ",")}.${decimal}`;
}

/**
 * O preço como o leitor daquele idioma deve vê-lo.
 *
 * `null` em centavos significa "este formato não tem preço", que é diferente
 * de "o preço é zero" — quem chama decide o texto do vazio, porque ele muda
 * conforme o lugar (card, tabela do painel, página do livro).
 */
export function formatarPreco(
  centavos: number | null,
  locale: "pt" | "en",
  taxa: Taxa,
): string | null {
  if (centavos === null) return null;
  if (locale === "pt") return formatarBRL(centavos);
  return formatarUSDAproximado(converterParaUsdCentavos(centavos, taxa));
}

/* -------------------------------------------------------------------------- */
/*  Entrada do administrador                                                   */
/* -------------------------------------------------------------------------- */

/**
 * O que o administrador digitou → centavos.
 *
 * Aceita `"73,92"`, `"73.92"`, `"R$ 73,92"`, `"1.234,56"` e `"73"`. Devolve
 * `null` para campo vazio (que é um preço legitimamente ausente) e `"erro"`
 * para texto que não é preço. Os dois casos são distintos e o chamador precisa
 * distingui-los: um salva `NULL`, o outro recusa o formulário.
 *
 * O ponto é tratado como separador de milhar quando há vírgula depois dele
 * (`1.234,56`) e como decimal quando não há (`73.92`). É a leitura que não
 * surpreende ninguém nos dois teclados.
 */
export function centavosDeTexto(valor: string): number | null | "erro" {
  const bruto = valor.trim().replace(/^R\$\s*/i, "").trim();
  if (bruto === "") return null;

  let normalizado: string;
  if (bruto.includes(",")) {
    normalizado = bruto.replace(/\./g, "").replace(",", ".");
  } else {
    /* Sem vírgula, um ponto com três dígitos depois é milhar ("1.234"), não
       um preço com três casas decimais — que não existe. */
    normalizado = /\.\d{3}$/.test(bruto) ? bruto.replace(/\./g, "") : bruto;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return "erro";

  const [inteira, decimal = ""] = normalizado.split(".");
  const centavos = Number(`${inteira}${decimal.padEnd(2, "0")}`);

  if (!Number.isSafeInteger(centavos)) return "erro";
  if (centavos < PRECO_MINIMO_CENTAVOS || centavos > PRECO_MAXIMO_CENTAVOS) {
    return "erro";
  }

  return centavos;
}

/**
 * Preenche o `{rate}` da nota de conversão com a cotação vigente.
 *
 * `5.10`, com duas casas, e não `5.1000`: é uma frase para o leitor entender a
 * ordem de grandeza, não a precisão interna do cálculo. As quatro casas
 * aparecem no painel, onde o administrador precisa vê-las.
 */
export function notaDeConversao(template: string, taxa: Taxa): string {
  const inteira = Math.trunc(taxa / 10_000);
  const centavos = String(Math.round((taxa % 10_000) / 100)).padStart(2, "0");
  return template.replace("{rate}", `${inteira}.${centavos}`);
}

/** Centavos → o texto que o campo do formulário mostra ao abrir para edição. */
export function centavosParaCampo(centavos: number | null): string {
  if (centavos === null) return "";
  const { inteira, decimal } = partir(centavos);
  return `${inteira},${decimal}`;
}
