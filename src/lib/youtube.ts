/**
 * Extrai o ID de um vídeo do YouTube.
 *
 * Módulo puro, sem I/O — dá para testar sem rede (ver tests/youtube.test.mts).
 *
 * Existe porque ninguém tem o ID na mão: a pessoa copia a URL da barra de
 * endereços. Exigir "cole apenas o ID" é empurrar para o usuário um trabalho
 * que onze linhas de código fazem melhor — e é onde nascem os erros de
 * digitação que só aparecem quando o aluno abre a aula.
 *
 * Aceita as formas que o YouTube realmente usa:
 *   https://www.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/live/ID
 *   https://www.youtube.com/shorts/ID
 *   https://www.youtube-nocookie.com/embed/ID
 *   ID puro
 *
 * Devolve null para qualquer outra coisa — inclusive links de outros serviços.
 * Aceitar "quase certo" aqui significa uma aula publicada com um player quebrado.
 */

/** Onze caracteres de [A-Za-z0-9_-]. É a forma do ID desde sempre. */
const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** Segmentos que precedem o ID no caminho. */
const PATH_PREFIXES = new Set(["embed", "live", "shorts", "v"]);

export function parseYouTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  // ID puro — o caminho mais curto, e o que a pessoa usa ao recadastrar.
  if (ID_PATTERN.test(value)) return value;

  let url: URL;
  try {
    // Sem esquema não é URL para o construtor; "youtu.be/ID" é colado assim
    // com frequência suficiente para valer o cuidado.
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  // ?v=ID — a forma canônica do watch.
  const fromQuery = url.searchParams.get("v");
  if (fromQuery && ID_PATTERN.test(fromQuery)) return fromQuery;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  // youtu.be/ID — o ID é o primeiro (e único) segmento.
  if (url.hostname.toLowerCase().endsWith("youtu.be")) {
    return ID_PATTERN.test(segments[0]) ? segments[0] : null;
  }

  // /embed/ID, /live/ID, /shorts/ID, /v/ID
  if (segments.length >= 2 && PATH_PREFIXES.has(segments[0].toLowerCase())) {
    return ID_PATTERN.test(segments[1]) ? segments[1] : null;
  }

  return null;
}

/** URL de visualização — usada só para o administrador conferir o que cadastrou. */
export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
