"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarCapituloAction } from "@/lib/actions/writing";

/**
 * =============================================================================
 *  EDITOR DE CAPÍTULO
 * =============================================================================
 *
 *  Um `<textarea>`, de propósito.
 *
 *  A alternativa seria um editor rico (TipTap, Lexical, Slate). Todos custam
 *  entre 100 e 300 KB de JavaScript, trazem superfície de XSS própria — porque
 *  passam a guardar HTML em vez de texto —, exigem sanitização na leitura e na
 *  escrita, e têm acessibilidade de teclado que precisa ser testada a cada
 *  atualização. Para um primeiro rascunho de livro, negrito e itálico não
 *  valem esse preço.
 *
 *  O conteúdo é TEXTO PURO, do banco à tela. Nunca é interpretado como HTML:
 *  o React escapa por padrão e não há `dangerouslySetInnerHTML` em lugar
 *  nenhum. Um capítulo que contenha `<script>` aparece como as letras
 *  `<script>`. Trocar por editor rico significa reabrir essa decisão inteira.
 *
 *  ---------------------------------------------------------------------------
 *  O autosave
 *  ---------------------------------------------------------------------------
 *  Debounce de 1,2 s depois da última tecla. Salvar a cada tecla afogaria o
 *  banco; salvar só no clique perde texto quando a aba fecha.
 *
 *  Três detalhes que o tornam confiável, e que só aparecem quando se usa de
 *  verdade:
 *
 *  1. **Não salva o que não mudou.** Comparar com o último valor gravado evita
 *     uma escrita a cada vez que a pessoa clica no texto e sai.
 *  2. **Não deixa duas gravações se atropelarem.** Enquanto uma está em voo, a
 *     próxima espera — senão a resposta lenta de uma escrita antiga pode
 *     chegar depois e mostrar uma contagem de palavras defasada.
 *  3. **Avisa antes de fechar com texto pendente.** É a última chance de não
 *     perder o parágrafo que a pessoa acabou de escrever.
 * =========================================================================== */

type Estado = "ocioso" | "pendente" | "salvando" | "salvo" | "erro";

const DEBOUNCE_MS = 1_200;

export function ChapterEditor({
  chapterId,
  initialTitle,
  initialContent,
  initialWordCount,
  locale,
  labels,
}: {
  chapterId: string;
  initialTitle: string;
  initialContent: string;
  initialWordCount: number;
  locale: "pt-BR" | "en-US";
  labels: {
    titlePlaceholder: string;
    contentPlaceholder: string;
    words: string;
    saving: string;
    saved: string;
    error: string;
    unsaved: string;
    beforeUnload: string;
    saveNow: string;
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [wordCount, setWordCount] = useState(initialWordCount);
  const [estado, setEstado] = useState<Estado>("ocioso");

  /* O que está de fato gravado no banco. Serve para dois julgamentos: "mudou
     alguma coisa?" e "posso fechar a aba?". Vive em ref porque mudá-lo não
     deve provocar render. */
  const gravado = useRef({ title: initialTitle, content: initialContent });
  const maisRecente = useRef({ title: initialTitle, content: initialContent });
  const drenagem = useRef<Promise<boolean> | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const salvar = useCallback(async (): Promise<boolean> => {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }

    // Toda chamada concorrente aguarda a MESMA drenagem. O laço relê
    // `maisRecente` depois de cada request; assim, uma tecla digitada durante
    // a gravação vira imediatamente o próximo snapshot, sem criar uma segunda
    // fila que possa ultrapassar a primeira.
    if (drenagem.current) return drenagem.current;

    const executar = async (): Promise<boolean> => {
      while (true) {
        const alvo = { ...maisRecente.current };
        if (alvo.title === gravado.current.title && alvo.content === gravado.current.content) {
          setEstado("salvo");
          return true;
        }

        setEstado("salvando");
        try {
          const resultado = await salvarCapituloAction({ chapterId, ...alvo });
          if (!resultado.ok) {
            setEstado("erro");
            return false;
          }
          gravado.current = alvo;
          setWordCount(resultado.wordCount);
        } catch {
          setEstado("erro");
          return false;
        }
      }
    };

    const atual = executar();
    drenagem.current = atual;
    try {
      return await atual;
    } finally {
      if (drenagem.current === atual) drenagem.current = null;
    }
  }, [chapterId]);

  /* Agenda a gravação. Cada tecla reinicia a contagem. */
  useEffect(() => {
    const mudou =
      title !== gravado.current.title || content !== gravado.current.content;
    if (!mudou) return;

    setEstado("pendente");
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void salvar(), DEBOUNCE_MS);

    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [title, content, salvar]);

  /* Links internos passam primeiro por uma gravação final. O listener em
     capture roda antes do handler do Link; se a gravação falhar, a pessoa
     permanece no editor com o estado de erro visível. */
  useEffect(() => {
    const aoClicar = (evento: MouseEvent) => {
      if (
        evento.defaultPrevented ||
        evento.button !== 0 ||
        evento.metaKey ||
        evento.ctrlKey ||
        evento.shiftKey ||
        evento.altKey
      ) {
        return;
      }

      const alvo = evento.target;
      if (!(alvo instanceof Element)) return;
      const ancora = alvo.closest<HTMLAnchorElement>("a[href]");
      if (!ancora || ancora.target === "_blank" || ancora.hasAttribute("download")) return;

      const destino = new URL(ancora.href, window.location.href);
      if (destino.origin !== window.location.origin) return;

      const pendente =
        maisRecente.current.title !== gravado.current.title ||
        maisRecente.current.content !== gravado.current.content;
      if (!pendente) return;

      evento.preventDefault();
      void (async () => {
        if (await salvar()) {
          router.push(`${destino.pathname}${destino.search}${destino.hash}`);
        }
      })();
    };

    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, [router, salvar]);

  /* Último aviso antes de perder texto. O navegador ignora a mensagem
     personalizada e mostra a dele — o que importa é que o diálogo apareça. */
  useEffect(() => {
    const aoSair = (evento: BeforeUnloadEvent) => {
      const pendente =
        title !== gravado.current.title || content !== gravado.current.content;
      if (!pendente) return;
      evento.preventDefault();
      evento.returnValue = labels.beforeUnload;
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [title, content, labels.beforeUnload]);

  const rotuloEstado =
    estado === "salvando"
      ? labels.saving
      : estado === "salvo"
        ? labels.saved
        : estado === "erro"
          ? labels.error
          : estado === "pendente"
            ? labels.unsaved
            : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={title}
          onChange={(e) => {
            const value = e.target.value;
            maisRecente.current = { ...maisRecente.current, title: value };
            setTitle(value);
            setEstado("pendente");
          }}
          placeholder={labels.titlePlaceholder}
          aria-label={labels.titlePlaceholder}
          maxLength={200}
          className="display min-w-0 flex-1 border-0 border-b border-panel-line bg-transparent pb-2 text-[1.375rem] leading-tight text-white outline-none transition-colors focus:border-gold md:text-[1.625rem]"
        />

        {/* `role="status"` para o leitor de tela anunciar "Salvo" sem roubar o
            foco de quem está digitando. */}
        <p
          role="status"
          aria-live="polite"
          className={`shrink-0 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] ${
            estado === "erro" ? "text-red-300" : "text-ash"
          }`}
        >
          {rotuloEstado}
        </p>

        <button
          type="button"
          onClick={() => void salvar()}
          className="shrink-0 rounded-[3px] border border-panel-line px-3 py-2 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ash transition-colors hover:border-gold hover:text-gold"
        >
          {labels.saveNow}
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => {
          const value = e.target.value;
          maisRecente.current = { ...maisRecente.current, content: value };
          setContent(value);
          setEstado("pendente");
        }}
        placeholder={labels.contentPlaceholder}
        aria-label={labels.contentPlaceholder}
        spellCheck
        /* `min-h` generoso e altura que cresce: escrever num campo pequeno com
           rolagem própria é desconfortável e esconde o que já foi escrito. */
        className="min-h-[26rem] w-full resize-y rounded-[3px] border border-panel-line bg-panel px-5 py-4 font-serif text-[1.0625rem] leading-[1.85] text-white outline-none transition-colors focus:border-gold md:min-h-[34rem] md:text-[1.125rem]"
      />

      <p className="text-sm text-ash">
        {wordCount.toLocaleString(locale)} {labels.words}
      </p>
    </div>
  );
}
