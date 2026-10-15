import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Resolve o alias "@/..." do tsconfig para o Node.
 *
 * Os testes rodam com o runner nativo do Node e `--experimental-strip-types`,
 * sem bundler — e o Node não lê `paths` do tsconfig. Enquanto os testes só
 * tocavam módulos puros sem imports de alias, dava para importar por caminho
 * relativo e pronto. Não dá mais: `src/content/site.ts` importa
 * `@/lib/routes` em tempo de EXECUÇÃO (não é `import type`, que sumiria na
 * remoção de tipos), então testar o conteúdo do site exige resolver o alias.
 *
 * A alternativa seria trocar o alias por caminho relativo dentro do código de
 * produção só para agradar o teste — pior: o teste passaria a ditar o estilo
 * do código. Trinta linhas de hook, zero dependência nova.
 */

const SRC = path.resolve(fileURLToPath(import.meta.url), "../../src");

/** A mesma ordem que o resolvedor de módulos do TypeScript tentaria. */
const CANDIDATES = ["", ".ts", ".tsx", ".mts", ".js", "/index.ts", "/index.tsx"];

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * `server-only` é um pacote que EXISTE para explodir: importá-lo fora do
 * ambiente de servidor do Next lança na hora, e é assim que ele protege
 * `src/lib/supabase/secret.ts` e `src/lib/security/turnstile.ts` de acabarem
 * num bundle de cliente.
 *
 * No runner do Node não há esse ambiente, então a proteção vira um obstáculo:
 * qualquer teste que alcance um desses módulos morre com "This module cannot
 * be imported from a Client Component module".
 *
 * Aqui ele é trocado por um módulo vazio. A garantia de verdade continua onde
 * sempre esteve — no build do Next, que é quem falha se um Client Component
 * importar um módulo server-only. O teste não enfraquece nada; só deixa de
 * tropeçar num guarda que não é para ele.
 */
const MODULO_VAZIO = "data:text/javascript,export {}";

export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: MODULO_VAZIO, shortCircuit: true };
  }
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const base = path.join(SRC, specifier.slice(2));
  for (const suffix of CANDIDATES) {
    const candidate = base + suffix;
    if (isFile(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }

  throw new Error(
    `alias "@/" não resolvido: ${specifier} (procurado a partir de ${SRC})`,
  );
}
