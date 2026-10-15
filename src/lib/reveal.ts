import type { CSSProperties } from "react";

/**
 * Atraso em cascata entre irmãos revelados no scroll.
 * O CSS lê --reveal-delay; o TypeScript não conhece custom properties em
 * CSSProperties, daí o cast pontual.
 */
export function revealDelay(index: number, step = 80): CSSProperties {
  return { "--reveal-delay": `${index * step}ms` } as CSSProperties;
}
