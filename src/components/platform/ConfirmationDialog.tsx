"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { buttonStyles, type ButtonTone } from "@/components/platform/ui";

/**
 * Confirmação antes de uma ação que não dá pra desfazer com um clique.
 *
 * O conteúdo do diálogo é `children` — normalmente o <form> com a Server
 * Action e os campos ocultos. Fazendo assim, a ação continua sendo um envio de
 * formulário de verdade (funciona sem JS até o ponto em que o diálogo entra), e
 * este componente não precisa saber nada sobre o que está confirmando.
 *
 * ACESSIBILIDADE — o mesmo cuidado do menu mobile da landing:
 *  - role="dialog" + aria-modal, rotulado pelo título e descrito pelo texto;
 *  - foco vai para o diálogo ao abrir e VOLTA para o gatilho ao fechar;
 *  - Tab fica preso dentro (senão o foco passeia pela página atrás, que
 *    continua no DOM);
 *  - Escape fecha;
 *  - o resto da página recebe `inert`, para não ser alcançável pelo modo de
 *    leitura do leitor de tela;
 *  - o scroll do documento trava enquanto está aberto.
 */
export function ConfirmationDialog({
  triggerLabel,
  triggerTone = "danger",
  title,
  description,
  cancelLabel = "Cancelar",
  children,
}: {
  triggerLabel: string;
  triggerTone?: ButtonTone;
  title: string;
  description: string;
  cancelLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const root = document.getElementById("plataforma-conteudo");
    root?.setAttribute("inert", "");

    // Foco no painel (não no botão de confirmar): abrir um diálogo já com o
    // dedo sobre a ação destrutiva convida ao Enter distraído.
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea',
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);

      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      // O inert sai antes do focus(): elemento inerte não recebe foco.
      root?.removeAttribute("inert");
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={buttonStyles[triggerTone]}
      >
        {triggerLabel}
      </button>

      {open
        ? createPortal(
            <div className="fade-in fixed inset-0 z-[80] flex items-end justify-center bg-void/80 p-4 backdrop-blur-sm sm:items-center">
              {/* Clicar fora fecha. É um <button> de tela cheia atrás do painel em
                  vez de um onClick numa div: continua alcançável por teclado e
                  anunciado como ação. */}
              <button
                type="button"
                onClick={close}
                tabIndex={-1}
                aria-hidden="true"
                className="absolute inset-0 cursor-default"
              />

              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                className="panel-enter relative w-full max-w-md rounded-[3px] border border-panel-line bg-panel p-6 shadow-[0_24px_60px_rgba(0,0,0,0.55)] focus:outline-none md:p-8"
              >
                <h2 id={titleId} className="display text-[1.25rem] text-warm-white">
                  {title}
                </h2>
                <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-ash">
                  {description}
                </p>

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={close} className={buttonStyles.secondary}>
                    {cancelLabel}
                  </button>
                  {children}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
