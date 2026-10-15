/**
 * =============================================================================
 *  RUNNER DO E2E — sobe o servidor, roda o teste, derruba o servidor
 * =============================================================================
 *
 *  `npm run test:e2e` sozinho EXIGE um servidor já no ar; é o modo local, e
 *  continua existindo porque no dia a dia o servidor já está rodando noutra
 *  aba. No CI não há aba nenhuma, então alguém precisa cuidar do ciclo de vida
 *  do processo — é este arquivo.
 *
 *  Três coisas que costumam dar errado aqui e estão tratadas:
 *
 *  1. ESPERAR DE VERDADE. Nada de `sleep 10`: em máquina lenta o teste começa
 *     antes do servidor e falha por motivo errado; em máquina rápida
 *     desperdiça segundos. O runner faz polling até a raiz responder.
 *
 *  2. NÃO DEIXAR ÓRFÃO. `next start` cria um processo filho. Se o runner morrer
 *     sem matá-lo, o job do CI trava até o timeout — o modo mais chato de
 *     falhar, porque não diz nada. O encerramento acontece em `finally` e
 *     também nos sinais.
 *
 *  3. PROPAGAR O CÓDIGO DE SAÍDA. O exit code do runner É o do teste. Sem isso
 *     o CI fica verde com teste vermelho, que é pior do que não ter CI.
 * =========================================================================== */

import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TEMPO_LIMITE_MS = 90_000;

/** `next` e `node` no Windows precisam de shell; no Linux do CI, não. */
const ehWindows = process.platform === "win32";

let servidor = null;

function derrubarServidor() {
  if (!servidor || servidor.killed) return;
  try {
    if (ehWindows) {
      /* No Windows, matar o pai não mata a árvore — e precisa ser SÍNCRONO.
         Com `spawn`, o `process.exit()` logo abaixo acontece antes de o
         taskkill sequer rodar, e o servidor fica escutando a porta depois que
         o runner some. Medido: acontecia toda vez. */
      spawnSync("taskkill", ["/pid", String(servidor.pid), "/f", "/t"], { stdio: "ignore" });
    } else {
      // Grupo de processos inteiro — o `-` no pid é o que alcança os filhos.
      process.kill(-servidor.pid, "SIGTERM");
    }
  } catch {
    // Já morreu. Não é erro.
  }
  servidor = null;
}

async function esperarServidor() {
  const limite = Date.now() + TEMPO_LIMITE_MS;
  while (Date.now() < limite) {
    try {
      const resposta = await fetch(BASE, { signal: AbortSignal.timeout(2_000) });
      if (resposta.ok) return true;
    } catch {
      // Ainda subindo.
    }
    await sleep(500);
  }
  return false;
}

function rodar(comando, argumentos) {
  return new Promise((resolve) => {
    const processo = spawn(comando, argumentos, {
      stdio: "inherit",
      shell: ehWindows,
    });
    processo.on("close", (codigo) => resolve(codigo ?? 1));
  });
}

// Ctrl+C e o SIGTERM que o CI manda ao cancelar um job.
for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    derrubarServidor();
    process.exit(1);
  });
}

let codigoDeSaida = 1;

try {
  console.log(`Subindo o servidor de produção para ${BASE}...`);

  servidor = spawn("npm", ["run", "start"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: ehWindows,
    // Grupo próprio para que `process.kill(-pid)` alcance a árvore no Linux.
    detached: !ehWindows,
  });

  // O log do servidor só aparece se algo der errado — senão polui a saída.
  const logDoServidor = [];
  servidor.stdout?.on("data", (d) => logDoServidor.push(String(d)));
  servidor.stderr?.on("data", (d) => logDoServidor.push(String(d)));

  servidor.on("exit", (codigo) => {
    if (codigo !== 0 && codigo !== null) {
      console.error(`O servidor saiu sozinho com código ${codigo}:`);
      console.error(logDoServidor.join(""));
    }
  });

  if (!(await esperarServidor())) {
    console.error(`O servidor não respondeu em ${TEMPO_LIMITE_MS / 1000}s. Log:`);
    console.error(logDoServidor.join(""));
    codigoDeSaida = 1;
  } else {
    console.log("Servidor no ar. Rodando o teste de navegação.\n");
    codigoDeSaida = await rodar("node", ["tests/e2e/navegacao-client-side.mjs"]);
  }
} finally {
  derrubarServidor();
}

process.exit(codigoDeSaida);
