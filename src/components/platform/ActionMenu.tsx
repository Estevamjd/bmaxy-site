"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Menu de ações secundárias (o "…" de uma linha de tabela ou de um cartão).
 *
 * Existe para tirar da tela ações que competem com a principal sem sumir com
 * elas. Se um item for a ação óbvia daquela linha, ele NÃO deve estar aqui —
 * deve ser um botão visível.
 *
 * Padrão de menu real, não uma div que abre: `aria-expanded`, setas navegam
 * entre os itens, Escape fecha e devolve o foco ao gatilho, clique fora fecha.
 */

export type ActionMenuItem =
  | { kind: "link"; label: string; href: string }
  | { kind: "button"; label: string; onSelect: () => void; tone?: "default" | "danger" };

export function ActionMenu({
  label = "Mais ações",
  items,
}: {
  label?: string;
  items: ActionMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const focusables = listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (!focusables?.length) return;
      event.preventDefault();

      const nodes = Array.from(focusables);
      const current = nodes.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "ArrowDown"
          ? (current + 1) % nodes.length
          : (current - 1 + nodes.length) % nodes.length;
      nodes[next]?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClasses =
    "flex w-full items-center px-4 py-2.5 text-left font-sans text-sm transition-colors duration-150";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-[3px] text-ash transition-colors duration-200 hover:bg-panel-hi hover:text-warm-white"
      >
        <span aria-hidden="true" className="text-lg leading-none tracking-widest">
          ⋯
        </span>
      </button>

      {open ? (
        <div
          ref={listRef}
          role="menu"
          aria-label={label}
          className="fade-in absolute right-0 z-40 mt-1 min-w-52 overflow-hidden rounded-[3px] border border-panel-line bg-panel py-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        >
          {items.map((item) =>
            item.kind === "link" ? (
              <Link
                key={item.label}
                role="menuitem"
                href={item.href}
                onClick={() => setOpen(false)}
                className={`${itemClasses} text-warm-white hover:bg-panel-hi`}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`${itemClasses} ${
                  item.tone === "danger"
                    ? "text-red-300 hover:bg-red-400/10"
                    : "text-warm-white hover:bg-panel-hi"
                }`}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
