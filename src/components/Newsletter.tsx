"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus } from "@/components/icons";
import type { SiteContent } from "@/content/site";

/**
 * Não renderizada em HomeSections.tsx: o formulário não envia nada de
 * verdade (sem backend, sem serviço de e-mail ligado) — prometer "material
 * gratuito" que nunca chega é enganoso. Ele só valida o formato do e-mail e
 * mostra sucesso localmente.
 * Quando houver integração real (Mailchimp, Beehiiv, ConvertKit), basta
 * trocar o corpo de handleSubmit por um fetch e religar o componente em
 * HomeSections.tsx; o resto da interface já está pronto. Destino combinado
 * com o cliente: site.footer.contact.email (contact@bmaxy.com).
 */
export default function Newsletter({ site }: { site: SiteContent }) {
  const { newsletter } = site;
  const fieldId = useId();
  const errorId = `${fieldId}-erro`;

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);

  /* No sucesso o <form> desmonta e o foco cairia no <body>. Levamos o foco
     para a mensagem, que é o novo conteúdo relevante. */
  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
    setStatus(valid ? "success" : "error");
    if (!valid) inputRef.current?.focus();
  }

  return (
    <section className="on-gold bg-gold text-void">
      <div className="container-site py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end lg:gap-x-16">
          <div className="lg:col-span-7">
            <p className="label-eyebrow flex items-center gap-3 text-void/70">
              <Plus className="h-3 w-3" />
              {newsletter.label}
            </p>
            <h2 className="display t-band mt-6 max-w-[18ch] text-void">
              {newsletter.title}
            </h2>
            <p className="measure mt-6 text-[1.0625rem] leading-relaxed text-void/80">
              {newsletter.description}
            </p>
          </div>

          <div className="lg:col-span-5">
            {/* Região viva permanente e de geometria fixa. Se ela nascesse
                junto com o texto, os leitores de tela não anunciariam nada. */}
            <p aria-live="polite" className="sr-only">
              {status === "success"
                ? newsletter.success
                : status === "error"
                  ? newsletter.invalid
                  : ""}
            </p>

            {status === "success" ? (
              <p
                ref={successRef}
                tabIndex={-1}
                className="flex items-start gap-3 border-t-2 border-void py-6 text-lg font-medium text-void"
              >
                <Plus className="mt-2 h-3.5 w-3.5 shrink-0" />
                {newsletter.success}
              </p>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <label
                  htmlFor={fieldId}
                  className="label-eyebrow block text-void/70"
                >
                  {newsletter.emailLabel}
                </label>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <input
                    ref={inputRef}
                    id={fieldId}
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    placeholder={newsletter.emailPlaceholder}
                    aria-invalid={status === "error"}
                    aria-describedby={status === "error" ? errorId : undefined}
                    className="w-full min-w-0 flex-1 rounded-[2px] border-2 border-void/60 bg-transparent px-4 py-3.5 text-base text-void placeholder:text-void/70 transition-colors duration-300 focus:border-void"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-[2px] bg-void px-7 py-3.5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-bone transition-colors duration-300 hover:bg-royal"
                  >
                    {newsletter.submit}
                  </button>
                </div>

                {/* Sem role="alert" aqui: o anúncio já sai pela região viva
                    acima. Este parágrafo é só o alvo do aria-describedby, senão
                    a mensagem seria falada duas vezes. */}
                {status === "error" ? (
                  <p id={errorId} className="mt-3 text-sm font-medium text-void">
                    {newsletter.invalid}
                  </p>
                ) : null}

                <p className="mt-4 text-sm text-void/70">{newsletter.legal}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
