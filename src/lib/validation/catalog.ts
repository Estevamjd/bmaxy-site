import { z } from "zod";
import { adminContent } from "@/content/admin";
import type { PlatformLocale } from "@/content/platform";
import { centavosDeTexto, taxaDeTexto } from "@/lib/money";

/**
 * =============================================================================
 *  VALIDAÇÃO DO CATÁLOGO
 * =============================================================================
 *
 *  Espelha os CHECK da migration, e isso é de propósito: quem valida de
 *  verdade é o banco, porque ele é a única camada que uma requisição forjada
 *  não contorna. O que está aqui existe para o administrador ver "este
 *  endereço não é da Amazon" em vez de "erro 23514".
 *
 *  A regra ao mexer: se um limite mudar aqui, mude na migration também. Uma
 *  validação MAIS FROUXA que o banco vira erro feio; MAIS RÍGIDA vira campo
 *  que o formulário recusa sem explicação possível.
 * =========================================================================== */

/* -------------------------------------------------------------------------- */
/*  Domínios das lojas                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A lista de domínios aceitos, e a razão de cada detalhe da comparação.
 *
 * O que se está impedindo é um link de vitrine apontando para fora — seja por
 * erro de cópia, seja por alguém com acesso ao painel transformando o botão
 * "Comprar na Amazon" em destino qualquer. O leitor confia no rótulo, não na
 * URL: ele não passa o mouse para conferir o domínio antes de clicar.
 *
 * A comparação é feita sobre `URL.hostname`, NUNCA sobre a string inteira.
 * Testar `url.includes("amazon.com")` aceitaria
 * `https://amazon.com.invasor.net/...` e `https://outro.site/?r=amazon.com` —
 * o hostname é a única parte que o navegador usa para decidir para onde vai.
 *
 * `endsWith("." + dominio)` cobre subdomínio legítimo (`www.amazon.com`,
 * `smile.amazon.com`) e o ponto no começo é o que impede `fakeamazon.com` de
 * passar por `amazon.com`.
 */
const DOMINIOS: Record<"amazon" | "clube_de_autores", string[]> = {
  amazon: ["amazon.com", "amazon.com.br"],
  clube_de_autores: ["clubedeautores.com.br"],
};

export function dominioPermitido(
  url: string,
  loja: "amazon" | "clube_de_autores",
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  /* Só https. `http://` viaja em claro e o navegador marca como não seguro;
     `javascript:` e `data:` executariam no clique. O CHECK do banco repete
     esta regra — aqui é para a mensagem ser legível. */
  if (parsed.protocol !== "https:") return false;

  /* Credenciais embutidas (`https://amazon.com@invasor.net/`) fazem o hostname
     real ser `invasor.net`, mas enganam quem lê a URL na barra de status. O
     `new URL` já separa isso corretamente — recusar de todo modo evita que um
     link assim chegue à vitrine parecendo legítimo. */
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  return DOMINIOS[loja].some((dominio) => host === dominio || host.endsWith(`.${dominio}`));
}

/* -------------------------------------------------------------------------- */
/*  Capa                                                                       */
/* -------------------------------------------------------------------------- */

/** Os mesmos três do bucket. Raster apenas — SVG é XML e executa script. */
export const TIPOS_CAPA = ["image/jpeg", "image/png", "image/webp"] as const;

/** 5 MiB, igual ao `file_size_limit` do bucket. */
export const TAMANHO_MAXIMO_CAPA = 5 * 1024 * 1024;

/**
 * Extensão a partir do tipo declarado, e não do nome do arquivo enviado.
 *
 * O nome vem do cliente e pode ser `capa.jpg.svg`, `../../algo` ou 300
 * caracteres de lixo. Nada dele é reaproveitado: o arquivo final recebe um
 * nome gerado pelo servidor, e a extensão sai desta tabela.
 */
export const EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/* -------------------------------------------------------------------------- */
/*  Esquemas                                                                   */
/* -------------------------------------------------------------------------- */

export function createCatalogValidation(locale: PlatformLocale) {
  const messages = adminContent[locale].validation;

  const slug = z
    .string()
    .trim()
    .min(1, messages.slugMinimum)
    .max(120, messages.slugMaximum)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, messages.slugFormat);

  const titulo = z
    .string()
    .trim()
    .min(1, messages.bookTitle)
    .max(200, messages.bookTitleLong);

  /** Campo de preço: vazio é `null` legítimo, texto inválido é erro. */
  const preco = z
    .string()
    .transform((valor) => centavosDeTexto(valor))
    .refine((valor) => valor !== "erro", { message: messages.priceInvalid })
    .transform((valor) => valor as number | null);

  const linkLoja = (loja: "amazon" | "clube_de_autores") =>
    z
      .string()
      .trim()
      .max(2000, messages.linkLong)
      .refine((valor) => valor === "" || valor.startsWith("https://"), {
        message: messages.linkHttps,
      })
      .refine((valor) => valor === "" || dominioPermitido(valor, loja), {
        message: loja === "amazon" ? messages.linkAmazonDomain : messages.linkClubeDomain,
      })
      /* String vazia vira `null`: "sem link" e "link em branco" são a mesma
         intenção, e a coluna não aceita URL vazia (CHECK de tamanho mínimo). */
      .transform((valor) => (valor === "" ? null : valor));

  return {
    /** Criar pede só o mínimo. O resto se preenche na edição, com o livro já existindo. */
    criarLivroSchema: z.object({
      slug,
      title: titulo,
    }),

    salvarLivroSchema: z.object({
      bookId: z.string().uuid(),
      slug,
      title: titulo,
      printPrice: preco,
      ebookPrice: preco,
      synopsisPt: z.string().trim().max(4000, messages.synopsisLong),
      synopsisEn: z.string().trim().max(4000, messages.synopsisLong),
      coverAltPt: z.string().trim().max(300, messages.coverAltLong),
      coverAltEn: z.string().trim().max(300, messages.coverAltLong),
      amazon: linkLoja("amazon"),
      clubeDeAutores: linkLoja("clube_de_autores"),
    }),

    statusLivroSchema: z.object({
      bookId: z.string().uuid(),
      status: z.enum(["draft", "published", "archived"]),
    }),

    moverLivroSchema: z.object({
      bookId: z.string().uuid(),
      direction: z.enum(["up", "down"]),
    }),

    cotacaoSchema: z.object({
      rate: z
        .string()
        .transform((valor) => taxaDeTexto(valor))
        .refine((valor) => valor !== null, { message: messages.rateInvalid }),
    }),
  };
}
