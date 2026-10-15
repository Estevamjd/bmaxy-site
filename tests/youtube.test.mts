import assert from "node:assert/strict";
import test from "node:test";
import { parseYouTubeVideoId, youTubeWatchUrl } from "../src/lib/youtube.ts";

/**
 * O administrador cola a URL da barra de endereços; o banco guarda só o ID.
 * Se esta conversão errar, a falha só aparece quando um ALUNO abre a aula e
 * encontra um player quebrado — por isso vale testar cada forma real.
 */

const ID = "dQw4w9WgXcQ";

test("aceita as formas reais de URL do YouTube", () => {
  const entradas = [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/v/${ID}`,
  ];

  for (const entrada of entradas) {
    assert.equal(parseYouTubeVideoId(entrada), ID, entrada);
  }
});

test("aceita o ID puro — é o que a pessoa cola ao recadastrar", () => {
  assert.equal(parseYouTubeVideoId(ID), ID);
  assert.equal(parseYouTubeVideoId(`  ${ID}  `), ID, "espaços em volta não atrapalham");
});

test("aceita URL sem esquema — colar 'youtu.be/ID' é comum", () => {
  assert.equal(parseYouTubeVideoId(`youtu.be/${ID}`), ID);
  assert.equal(parseYouTubeVideoId(`www.youtube.com/watch?v=${ID}`), ID);
});

test("ignora parâmetros extras que o YouTube gruda ao compartilhar", () => {
  assert.equal(parseYouTubeVideoId(`https://youtu.be/${ID}?t=42`), ID);
  assert.equal(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${ID}&list=PL123&index=2`), ID);
});

test("recusa link de outro serviço", () => {
  // Aceitar "quase certo" aqui significa uma aula publicada com player quebrado.
  for (const entrada of [
    "https://vimeo.com/123456789",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://youtubeee.com/watch?v=dQw4w9WgXcQ",
  ]) {
    assert.equal(parseYouTubeVideoId(entrada), null, entrada);
  }
});

test("recusa ID com formato errado", () => {
  for (const entrada of [
    "",
    "   ",
    "abc",
    "dQw4w9WgXc", // 10 caracteres
    "dQw4w9WgXcQQ", // 12
    "dQw4w9WgXc!", // caractere inválido
    `https://www.youtube.com/watch?v=curto`,
    "https://www.youtube.com/",
    "https://youtu.be/",
  ]) {
    assert.equal(parseYouTubeVideoId(entrada), null, JSON.stringify(entrada));
  }
});

test("recusa texto que não é URL nem ID", () => {
  assert.equal(parseYouTubeVideoId("meu vídeo da aula 3"), null);
  assert.equal(parseYouTubeVideoId("javascript:alert(1)"), null);
});

test("monta a URL de conferência a partir do ID", () => {
  assert.equal(youTubeWatchUrl(ID), `https://www.youtube.com/watch?v=${ID}`);
});
