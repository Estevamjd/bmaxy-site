/* =============================================================================
   SÍMBOLO DA MARCA — BMaxy
   =============================================================================

   Redesenho vetorial do símbolo da logo oficial: o B de duas cores separadas
   por uma diagonal, a pena dourada descendo da direita com o bico escrevendo, e
   o livro aberto de páginas brancas sobre a folha violeta.

   POR QUE VETOR E NÃO O PNG:
   o arquivo original (bmaxy_logo2.png, 1024×1024) traz símbolo + nome + tagline
   juntos, desenhados em azul escuro para fundo claro. Num site em --void o nome
   desaparece, e um PNG recortado a 40px de altura fica sujo. Aqui o símbolo é
   vetor, nítido em qualquer tamanho, e o nome "BMAXY" ao lado é TEXTO VIVO em
   Archivo — igual ao que as duas referências de direção de arte fazem.

   AS CORES MUDAM POR `tone`, DE PROPÓSITO:
   sobre --void o índigo da marca daria ~2:1 de contraste e sumiria. Em
   tone="light" o corpo do B vira branco e a diagonal vira --violet-hi,
   preservando a estrutura de duas cores da logo com leitura de verdade.
   tone="dark" usa --royal e --violet reais, para as seções em --bone.

   >>> AQUI ENTRA A VERSÃO VETORIAL OFICIAL DO CLIENTE, SE VIER UMA. <<<
   1. Peça o símbolo isolado em SVG (sem o nome, sem a tagline).
   2. Troque os <path> abaixo, mantendo o viewBox em 0 0 96 96.
   3. Mantenha o padrão de duas cores por `tone`.
   4. Atualize junto os dois gêmeos estáticos, que têm as MESMAS coordenadas:
      /public/brand/bmaxy-mark.svg  e  /src/app/icon.svg (favicon).

   O arquivo completo (símbolo + nome + tagline) continua válido, mas só sobre
   fundo --bone. Se for usá-lo, guarde-o em /public/brand/bmaxy-logo-full.png.
   ========================================================================== */

type BrandMarkProps = {
  className?: string;
  /** "light" = fundos escuros (padrão). "dark" = seções em --bone. */
  tone?: "light" | "dark";
  /** Sufixo dos ids internos — precisa ser único por instância na página. */
  uid?: string;
  /** Descrição acessível. Sem ela o símbolo é tratado como decorativo. */
  title?: string;
};

/* O B é um caminho só: haste, dois bojos e os dois contraformas. Serve de
   clipPath para as duas cores entrarem por cima.
   Atenção: dentro de <clipPath> quem decide o recorte é `clip-rule`, NÃO
   `fill-rule` — com o padrão (nonzero) os contraformas ficariam preenchidos.
   Os bojos usam arco ELÍPTICO: num arco circular a barriga é sempre metade da
   altura, e o B ficaria estreito demais. */
const B_PATH =
  "M10 5 H21 V69 H10 Z " +
  "M21 5 H28 A23 16.5 0 0 1 28 38 H21 Z " +
  "M21 15.5 H28 A12.5 6 0 0 1 28 27.5 H21 Z " +
  "M21 38 H29 A26 15.5 0 0 1 29 69 H21 Z " +
  "M21 48.5 H29 A15.5 5 0 0 1 29 58.5 H21 Z";

/* Corte diagonal que separa o índigo do violeta, como na logo. */
const DIAGONAL = "M40 0 H96 V96 H22 Z";

export default function BrandMark({
  className,
  tone = "light",
  uid = "hdr",
  title,
}: BrandMarkProps) {
  const letter = tone === "light" ? "#FFFFFF" : "var(--royal)";
  const letterSide = tone === "light" ? "var(--violet-hi)" : "var(--violet)";
  const pageUnder = tone === "light" ? "var(--violet-hi)" : "var(--violet)";
  const pageEdge = tone === "light" ? "none" : "var(--royal)";
  const nib = tone === "light" ? "var(--violet-hi)" : "var(--royal)";
  const nibSlit = tone === "light" ? "var(--void)" : "#FFFFFF";

  const clipId = `bmaxy-b-${uid}`;
  const gradId = `bmaxy-quill-${uid}`;
  const titleId = `bmaxy-title-${uid}`;

  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? titleId : undefined}
      focusable="false"
    >
      {title ? <title id={titleId}>{title}</title> : null}

      <defs>
        {/* O único gradiente do projeto: a pena. --gold-hi → --gold. */}
        <linearGradient
          id={gradId}
          x1="91"
          y1="4"
          x2="43.5"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--gold-hi)" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>

        <clipPath id={clipId}>
          <path clipRule="evenodd" d={B_PATH} />
        </clipPath>
      </defs>

      {/* 1. O B, em duas cores separadas por uma diagonal */}
      <g clipPath={`url(#${clipId})`}>
        <path fill={letter} d="M0 0 H96 V96 H0 Z" />
        <path fill={letterSide} d={DIAGONAL} />
      </g>

      {/* 2. O livro aberto: folha violeta embaixo, páginas brancas por cima */}
      <path
        fill={pageUnder}
        d="M17 61 C27 55.5 39 55.5 45 60.5 L45 80 C39 75 27 75 17 81 Z"
      />
      <path
        fill={pageUnder}
        d="M73 61 C63 55.5 51 55.5 45 60.5 L45 80 C51 75 63 75 73 81 Z"
      />
      <path
        fill="#FFFFFF"
        stroke={pageEdge}
        strokeWidth="1.1"
        d="M20 58 C29 53 40 53 45 57.5 L45 76 C40 71.5 29 71.5 20 77 Z"
      />
      <path
        fill="#FFFFFF"
        stroke={pageEdge}
        strokeWidth="1.1"
        d="M70 58 C61 53 50 53 45 57.5 L45 76 C50 71.5 61 71.5 70 77 Z"
      />

      {/* 3. A pena, descendo da direita e cruzando o B */}
      <path
        fill={`url(#${gradId})`}
        d="M91 4 C78 8.5 62.5 19 53 31 C48 37.5 45 43 43.5 47.5
           L49.5 44.5 C60.5 39.5 72 30.5 80.5 20 C87 12 90.5 7 91 4 Z"
      />
      {/* ráquis — o sulco central */}
      <path
        d="M87.5 7.5 C75 16 61 28 49 43.5"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.6"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      {/* 4. O bico, escrevendo sobre a página */}
      <path fill={nib} d="M41.5 49.5 L52 41.5 L36.5 61.5 Z" />
      <path
        d="M37.6 60 L48 47"
        fill="none"
        stroke={nibSlit}
        strokeOpacity="0.5"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
