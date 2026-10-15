import { register } from "node:module";

/**
 * Entrada de `node --import`. Registra o hook que resolve "@/..." antes de
 * qualquer arquivo de teste ser carregado. Ver tests/alias-hook.mjs.
 */
register("./alias-hook.mjs", import.meta.url);
