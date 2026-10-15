"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markLessonCompleteAction } from "@/lib/actions/progress";
import { IconCheck, IconClock, IconLock } from "@/components/platform/icons";
import { buttonStyles, ErrorNotice } from "@/components/platform/ui";

/**
 * =============================================================================
 *  PLAYER DA AULA — conclusão pelo evento ENDED do YouTube
 * =============================================================================
 *
 *  A aula é marcada como concluída quando o player emite ENDED (estado 0 da
 *  YouTube IFrame API), não quando a pessoa clica num botão. Antes existia um
 *  "Marcar aula como concluída" que era o caminho normal — ou seja, dava para
 *  liberar o curso inteiro sem assistir a nada.
 *
 *  O QUE ISTO É, E O QUE NÃO É
 *  ---------------------------
 *  Isto é proteção de EXPERIÊNCIA, não DRM. Quem quiser burlar consegue: o
 *  vídeo roda no navegador da pessoa, dá para pular para o fim da timeline,
 *  chamar a API do player pelo console ou disparar a Server Action na mão. Um
 *  iframe do YouTube não impede nada disso, e nenhuma implementação de player
 *  em navegador impediria.
 *
 *  O que sustenta a regra de verdade está no servidor e no banco:
 *  `complete_lesson()` (security definer) revalida autenticação, matrícula
 *  ativa, curso e aula publicados, mídia cadastrada e conclusão de TODAS as
 *  aulas publicadas anteriores. E `get_lesson_playback()` só entrega o
 *  video_id de uma aula já desbloqueada — então pular a aula 3 não adianta:
 *  o ID do vídeo dela nem chega ao navegador.
 *
 *  Ou seja: a barreira do YouTube evita conclusão acidental e desatenta; a
 *  barreira do banco é a que não se contorna.
 *
 *  O BOTÃO MANUAL
 *  --------------
 *  Continua existindo, mas como SAÍDA DE EMERGÊNCIA, não como caminho
 *  normal: só aparece depois que o vídeo terminou e a gravação automática
 *  falhou (rede caiu, sessão expirou). Sem ele, uma falha de rede deixaria a
 *  pessoa presa numa aula que ela de fato assistiu. Ele não aparece antes do
 *  ENDED, então não é atalho para nada.
 * =========================================================================== */

/** Estados relevantes do onStateChange da IFrame API. */
const YT_ENDED = 0;

const API_SRC = "https://www.youtube.com/iframe_api";

type YTPlayer = { destroy: () => void };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: { onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Carrega o script da IFrame API uma vez só por página e resolve quando
 * `window.YT.Player` existir. Várias instâncias do player (ou remontagens do
 * React) reaproveitam a mesma promessa em vez de injetar o script de novo.
 */
let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("sem window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    // O script chama este callback global quando termina de carregar. Se
    // outra coisa já o definiu, encadeamos em vez de sobrescrever.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YT.Player ausente após o carregamento"));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${API_SRC}"]`);
    if (existing) return;

    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => reject(new Error("falha ao carregar a IFrame API"));
    document.head.appendChild(script);
  });

  return apiPromise;
}

type CompletionState = "idle" | "saving" | "done" | "failed";

export type LessonPlayerLabels = {
  completionFailed: string;
  loadFailed: string;
  comingSoon: string;
  unpublished: string;
  comingSoonBody: string;
  unpublishedBody: string;
  completed: string;
  saving: string;
  automatic: string;
  retry: string;
  locked: string;
  lockedBody: string;
};

export function LessonPlayer({
  lessonId,
  playback,
  status,
  completed,
  labels,
}: {
  lessonId: string;
  /**
   * null quando a aula não tem vídeo liberado para esta pessoa. Vem de
   * getLessonPlayback(), que já passou pela função segura do banco — este
   * componente nunca recebe o id de uma aula bloqueada.
   */
  playback: { provider: "youtube"; videoId: string } | null;
  status: string;
  completed: boolean;
  labels: LessonPlayerLabels;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CompletionState>(completed ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const complete = useCallback(async () => {
    setState("saving");
    setError(null);

    const formData = new FormData();
    formData.append("lessonId", lessonId);

    // A MESMA Server Action de sempre: a validação de servidor não muda por
    // causa da origem do disparo. O banco não sabe (nem precisa saber) se
    // quem pediu foi o evento ENDED ou o botão de emergência.
    const result = await markLessonCompleteAction(undefined, formData);

    if (result?.success) {
      setState("done");
      return;
    }
    setState("failed");
    setError(result?.error ?? labels.completionFailed);
  }, [labels.completionFailed, lessonId]);

  useEffect(() => {
    if (!playback || completed) return;

    let player: YTPlayer | null = null;
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        player = new YT.Player(hostRef.current, {
          videoId: playback.videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            // A IFrame API exige `origin` quando o host difere do embed.
            origin: window.location.origin,
          },
          events: {
            onStateChange: (event) => {
              if (event.data !== YT_ENDED) return;
              setEnded(true);
              void complete();
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError(labels.loadFailed);
      });

    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [playback, completed, complete, labels.loadFailed]);

  if (!playback) {
    const comingSoon = status === "coming_soon";
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-[3px] border border-panel-line bg-panel">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <span
            aria-hidden="true"
            className={`flex h-12 w-12 items-center justify-center rounded-full border ${
              comingSoon
                ? "border-violet-hi/35 bg-violet-hi/10 text-violet-hi"
                : "border-panel-line bg-panel-hi text-ash"
            }`}
          >
            <IconClock className="h-5 w-5" />
          </span>
          <p className="display text-[1.0625rem] text-warm-white">
            {comingSoon ? labels.comingSoon : labels.unpublished}
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-ash">
            {comingSoon
              ? labels.comingSoonBody
              : labels.unpublishedBody}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* O <div> é substituído pelo <iframe> que a IFrame API cria. Sem JS
          nada é montado — e é o correto: sem JS também não há como detectar o
          fim do vídeo, então não faria sentido reproduzir. */}
      <div className="aspect-video w-full overflow-hidden rounded-[3px] border border-panel-line bg-black">
        <div ref={hostRef} className="h-full w-full" />
      </div>

      <div className="mt-4 space-y-3">
        {state === "done" ? (
          <p
            role="status"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-300"
          >
            <IconCheck className="h-4 w-4" /> {labels.completed}
          </p>
        ) : state === "saving" ? (
          <p role="status" className="text-sm text-ash">
            {labels.saving}
          </p>
        ) : (
          <p className="text-sm text-ash">
            {labels.automatic}
          </p>
        )}

        <ErrorNotice message={error} />

        {/* Saída de emergência: só depois do vídeo ter terminado E a gravação
            automática ter falhado. Antes disso não existe botão nenhum. */}
        {ended && state === "failed" ? (
          <button type="button" onClick={() => void complete()} className={buttonStyles.secondary}>
            {labels.retry}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function LockedLessonNotice({ labels }: { labels: LessonPlayerLabels }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-[3px] border border-dashed border-panel-line bg-panel px-6 text-center">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-panel-line bg-panel-hi text-ash"
      >
        <IconLock className="h-5 w-5" />
      </span>
      <p className="display text-[1.0625rem] text-warm-white">{labels.locked}</p>
      <p className="max-w-xs text-sm leading-relaxed text-ash">
        {labels.lockedBody}
      </p>
    </div>
  );
}
