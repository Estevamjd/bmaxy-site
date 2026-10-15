import { Archivo, Inter } from "next/font/google";

/**
 * Duas famílias, só. Archivo é a de display (sempre caixa alta, 700–800),
 * Inter é a de corpo e interface. Ambas variáveis, com display: "swap" para
 * não bloquear a primeira pintura.
 */

export const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
});

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
