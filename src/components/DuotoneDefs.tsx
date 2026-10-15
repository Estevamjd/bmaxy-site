/**
 * Definição única do filtro duotone --void / --violet usado nas fotografias.
 * Fica no layout, fora do fluxo, e é referenciado por `.duotone img` no CSS.
 *
 * A matriz achata a foto em luminância; a tabela de transferência remapeia
 * preto → --void (7,8,42) e branco → --violet (125,93,228).
 */
export default function DuotoneDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="bmaxy-duotone" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0      0      0      1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.027 0.490" />
            <feFuncG type="table" tableValues="0.031 0.365" />
            <feFuncB type="table" tableValues="0.165 0.894" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
