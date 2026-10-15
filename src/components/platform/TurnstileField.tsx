"use client";

import { useEffect, useRef } from "react";

/**
 * =============================================================================
 *  WIDGET DO CLOUDFLARE TURNSTILE
 * =============================================================================
 *
 *  Renderiza o desafio e deixa o token num input escondido, para a Server
 *  Action ler do FormData como qualquer outro campo. O nome `cf-turnstile-
 *  response` é o que a Cloudflare usa por convenção — o widget cria esse input
 *  sozinho, e o servidor procura por ele.
 *
 *  ---------------------------------------------------------------------------
 *  O DETALHE QUE QUEBRA NA SEGUNDA TENTATIVA
 *  ---------------------------------------------------------------------------
 *  O token do Turnstile é de USO ÚNICO e vale 5 minutos. Na prática isso
 *  significa: a pessoa erra a senha, o formulário volta com o erro, ela corrige
 *  e envia de novo — e o segundo envio manda o MESMO token, que a Cloudflare já
 *  consumiu. A resposta vem `timeout-or-duplicate` e a pessoa leva um erro de
 *  segurança quando o que ela fez de errado foi digitar a senha errada uma vez.
 *
 *  Por isso o `key` do componente: o pai passa um valor que muda a cada
 *  resposta do servidor, o React desmonta e remonta este componente, e o
 *  widget nasce limpo com um token novo. É mais confiável do que chamar
 *  `turnstile.reset()` na mão, porque não depende de o script já ter carregado
 *  nem de guardar o id do widget entre renderizações.
 *
 *  ---------------------------------------------------------------------------
 *  Sem site key configurada
 *  ---------------------------------------------------------------------------
 *  Não renderiza nada. Em desenvolvimento é o que mantém os formulários
 *  utilizáveis sem conta na Cloudflare; em produção o servidor recusa a ação de
 *  qualquer jeito (ver `isTurnstileObrigatorio`), então a ausência do widget
 *  aqui nunca vira uma porta aberta.
 * =========================================================================== */

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        alvo: HTMLElement,
        opcoes: { sitekey: string; theme?: "auto" | "light" | "dark"; language?: string },
      ) => string | undefined;
      remove: (id: string) => void;
    };
  }
}

/** Carrega o script uma vez só, por mais formulários que existam na página. */
function carregarScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  const existente = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existente) {
    return new Promise((resolve) => existente.addEventListener("load", () => resolve(), { once: true }));
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    // Falha ao carregar (rede, bloqueador) resolve mesmo assim: quem decide se
    // a ação passa ou não é o servidor, não este componente.
    script.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(script);
  });
}

export function TurnstileField({ locale = "pt" }: { locale?: "pt" | "en" }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const alvo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey || !alvo.current) return;

    let widgetId: string | undefined;
    let vivo = true;

    void carregarScript().then(() => {
      if (!vivo || !alvo.current || !window.turnstile) return;
      widgetId = window.turnstile.render(alvo.current, {
        sitekey: siteKey,
        theme: "dark",
        language: locale === "en" ? "en" : "pt-br",
      });
    });

    return () => {
      vivo = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, locale]);

  if (!siteKey) return null;

  return <div ref={alvo} className="min-h-[65px]" />;
}
