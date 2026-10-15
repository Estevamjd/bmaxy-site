"use client";

import { useState } from "react";
import {
  ActionForm,
  DangerActionForm,
  Field,
  IconSubmitButton,
  SubmitButton,
  TextAreaField,
} from "@/components/platform/AdminForms";
import { IconArrowDown, IconArrowUp, IconPlus } from "@/components/platform/icons";
import { buttonStyles, FormSection, InfoNotice } from "@/components/platform/ui";
import { formatAdminMessage, type AdminContent } from "@/content/admin";
import {
  centavosParaCampo,
  formatarPreco,
  formatarTaxa,
  taxaDeTexto,
  type Taxa,
} from "@/lib/money";
import {
  alterarStatusLivroAction,
  criarLivroAction,
  enviarCapaAction,
  moverLivroAction,
  restaurarLivroAction,
  salvarCotacaoAction,
  salvarLivroAction,
} from "@/lib/actions/catalog";
import type { LivroAdmin } from "@/lib/dal/catalog";

/**
 * =============================================================================
 *  FORMULÁRIOS DO CATÁLOGO
 * =============================================================================
 *
 *  Mesmo contrato do editor de curso: <form> + Server Action, sem `fetch`
 *  manual e sem estado de dados no cliente. Esconder botão nunca foi
 *  autorização — quem decide é o `requireAdmin()` dentro da action, e a RLS
 *  atrás dela.
 *
 *  O estado local que existe aqui é só de INTERFACE: revelar um formulário,
 *  mostrar quanto ficaria o preço em dólar enquanto a cotação é digitada.
 *  Nada disso viaja para o servidor nem substitui validação.
 * =========================================================================== */

/* -------------------------------------------------------------------------- */
/*  Criar                                                                      */
/* -------------------------------------------------------------------------- */

export function CreateBookForm({ content }: { content: AdminContent }) {
  const copy = content.books;
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={buttonStyles.secondary}>
        <IconPlus className="h-4 w-4" />
        {copy.newBook}
      </button>
    );
  }

  return (
    <div className="rounded-[3px] border border-panel-line bg-panel-hi p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="label-eyebrow text-ash">{copy.formNewTitle}</p>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className={buttonStyles.ghost}
        >
          {content.common.cancel}
        </button>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-ash">{copy.formNewLead}</p>

      <ActionForm action={criarLivroAction}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.fieldTitle} name="title" required hint={copy.fieldTitleHelp} />
          <Field label={copy.fieldSlug} name="slug" required hint={copy.fieldSlugHelp} />
        </div>
        <div className="mt-4">
          <SubmitButton pendingLabel={content.common.creating}>{copy.create}</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reordenar                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Duas setas por linha. O primeiro e o último livro perdem a seta que não tem
 * para onde ir — a action também devolve "já está nesta ponta", mas um botão
 * que não faz nada é pior do que um botão ausente.
 */
export function BookOrderButtons({
  book,
  isFirst,
  isLast,
  content,
}: {
  book: LivroAdmin;
  isFirst: boolean;
  isLast: boolean;
  content: AdminContent;
}) {
  const copy = content.books;

  return (
    <div className="flex items-center gap-1">
      {isFirst ? (
        <span className="inline-block h-11 w-11" aria-hidden />
      ) : (
        <ActionForm action={moverLivroAction} hidden={{ bookId: book.id, direction: "up" }}>
          <IconSubmitButton label={`${copy.moveUp}: ${book.title}`}>
            <IconArrowUp className="h-4 w-4" />
          </IconSubmitButton>
        </ActionForm>
      )}

      {isLast ? (
        <span className="inline-block h-11 w-11" aria-hidden />
      ) : (
        <ActionForm action={moverLivroAction} hidden={{ bookId: book.id, direction: "down" }}>
          <IconSubmitButton label={`${copy.moveDown}: ${book.title}`}>
            <IconArrowDown className="h-4 w-4" />
          </IconSubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Publicar / arquivar                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Publicar e despublicar são reversíveis e não pedem confirmação. Arquivar
 * pede — não porque destrua alguma coisa (não destrói), mas porque tira o
 * livro da lista padrão, e um clique acidental deixaria o administrador
 * procurando um título que "sumiu".
 */
export function BookStatusForms({
  book,
  content,
}: {
  book: LivroAdmin;
  content: AdminContent;
}) {
  const copy = content.books;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {book.status !== "published" ? (
        <ActionForm
          action={book.status === "archived" ? restaurarLivroAction : alterarStatusLivroAction}
          hidden={{
            bookId: book.id,
            status: book.status === "archived" ? "draft" : "published",
          }}
          noticePosition="bottom"
        >
          <SubmitButton pendingLabel={content.common.saving}>
            {book.status === "archived" ? copy.restore : copy.publish}
          </SubmitButton>
        </ActionForm>
      ) : (
        <ActionForm
          action={alterarStatusLivroAction}
          hidden={{ bookId: book.id, status: "draft" }}
          noticePosition="bottom"
        >
          <SubmitButton tone="secondary" pendingLabel={content.common.saving}>
            {copy.unpublish}
          </SubmitButton>
        </ActionForm>
      )}

      {book.status !== "archived" ? (
        <DangerActionForm
          action={alterarStatusLivroAction}
          hidden={{ bookId: book.id, status: "archived" }}
          triggerLabel={copy.archive}
          title={copy.archive}
          description={copy.archiveConfirm}
          confirmLabel={copy.archive}
          cancelLabel={content.common.cancel}
          pendingLabel={content.common.wait}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Editar                                                                     */
/* -------------------------------------------------------------------------- */

export function BookEditForm({
  book,
  content,
}: {
  book: LivroAdmin;
  content: AdminContent;
}) {
  const copy = content.books;
  const [slug, setSlug] = useState(book.slug);

  return (
    <ActionForm action={salvarLivroAction} hidden={{ bookId: book.id }} noticePosition="bottom">
      <FormSection title={copy.sectionIdentity}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={copy.fieldTitle}
            name="title"
            required
            defaultValue={book.title}
            hint={copy.fieldTitleHelp}
          />
          <Field
            label={copy.fieldSlug}
            name="slug"
            required
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            hint={copy.fieldSlugHelp}
          />
        </div>

        {/* O aviso só aparece quando o endereço de fato mudou. Um alerta
            permanente vira decoração e some da percepção em uma semana. */}
        {slug !== book.slug ? (
          <div className="mt-4">
            <InfoNotice>{copy.fieldSlugWarning}</InfoNotice>
          </div>
        ) : null}
      </FormSection>

      <FormSection title={copy.sectionPrices}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={copy.fieldPrintPrice}
            name="printPrice"
            inputMode="decimal"
            defaultValue={centavosParaCampo(book.printPriceCents)}
            placeholder="73,92"
            hint={copy.fieldPriceHelp}
          />
          <Field
            label={copy.fieldEbookPrice}
            name="ebookPrice"
            inputMode="decimal"
            defaultValue={centavosParaCampo(book.ebookPriceCents)}
            placeholder="35,50"
            hint={copy.fieldPriceHelp}
          />
        </div>
      </FormSection>

      <FormSection title={copy.sectionPt}>
        <TextAreaField
          label={copy.fieldSynopsisPt}
          name="synopsisPt"
          rows={5}
          defaultValue={book.localizacoes.pt.synopsis}
        />
        <div className="mt-4">
          <Field
            label={copy.fieldCoverAltPt}
            name="coverAltPt"
            defaultValue={book.localizacoes.pt.coverAlt}
            hint={copy.fieldCoverAltHelp}
          />
        </div>
      </FormSection>

      <FormSection title={copy.sectionEn}>
        <TextAreaField
          label={copy.fieldSynopsisEn}
          name="synopsisEn"
          rows={5}
          defaultValue={book.localizacoes.en.synopsis}
        />
        <div className="mt-4">
          <Field
            label={copy.fieldCoverAltEn}
            name="coverAltEn"
            defaultValue={book.localizacoes.en.coverAlt}
            hint={copy.fieldCoverAltHelp}
          />
        </div>
      </FormSection>

      <FormSection title={copy.sectionLinks}>
        <div className="grid gap-4">
          <Field
            label={copy.fieldAmazon}
            name="amazon"
            type="url"
            defaultValue={book.links.amazon ?? ""}
            placeholder="https://www.amazon.com/dp/..."
            hint={copy.fieldLinkHelp}
          />
          <Field
            label={copy.fieldClube}
            name="clubeDeAutores"
            type="url"
            defaultValue={book.links.clube_de_autores ?? ""}
            placeholder="https://clubedeautores.com.br/livro/..."
            hint={copy.fieldLinkHelp}
          />
        </div>
      </FormSection>

      <div className="mt-6">
        <SubmitButton pendingLabel={content.common.saving}>{copy.save}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/* -------------------------------------------------------------------------- */
/*  Capa                                                                       */
/* -------------------------------------------------------------------------- */

export function CoverForm({ book, content }: { book: LivroAdmin; content: AdminContent }) {
  const copy = content.books;

  return (
    <ActionForm action={enviarCapaAction} hidden={{ bookId: book.id }} noticePosition="bottom">
      {/* `accept` é conveniência do seletor de arquivos, não validação: ele
          filtra o que o diálogo mostra e nada mais. Quem recusa de verdade é a
          action e, depois dela, o bucket. */}
      <Field
        label={copy.coverField}
        name="cover"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
        hint={copy.coverHelp}
      />
      <div className="mt-4">
        <SubmitButton tone="secondary" pendingLabel={copy.coverSending}>
          {copy.coverSend}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cotação                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * O exemplo ao vivo não é enfeite.
 *
 * A cotação é o único campo do painel cuja alteração muda o que TODOS os
 * livros mostram. Digitar "51" em vez de "5,1" multiplicaria por dez o preço
 * em dólar do catálogo inteiro, e o administrador só descobriria abrindo a
 * vitrine em inglês. Ver "R$ 73,92 aparece como Approx. US$ 1.45" antes de
 * salvar transforma um erro caro num erro impossível de não notar.
 *
 * O cálculo aqui usa exatamente as mesmas funções do servidor — não é uma
 * segunda implementação que possa discordar da primeira.
 */
export function RateForm({
  taxa,
  atualizadaEm,
  content,
  locale,
}: {
  taxa: Taxa;
  atualizadaEm: string | null;
  content: AdminContent;
  locale: "pt" | "en";
}) {
  const copy = content.books;
  const [texto, setTexto] = useState(String(taxa / 10_000).replace(".", ","));

  const digitada = taxaDeTexto(texto);
  const exemplo = digitada ? formatarPreco(7392, "en", digitada) : null;

  return (
    <div>
      <p className="text-sm leading-relaxed text-ash">{copy.rateLead}</p>

      <p className="mt-3 text-sm text-ash">
        {formatAdminMessage(copy.rateCurrent, { rate: formatarTaxa(taxa) })}{" "}
        {atualizadaEm
          ? formatAdminMessage(copy.rateUpdatedAt, {
              date: new Date(atualizadaEm).toLocaleDateString(
                locale === "en" ? "en-US" : "pt-BR",
              ),
            })
          : copy.rateNever}
      </p>

      <div className="mt-4">
        <InfoNotice>{copy.rateEffect}</InfoNotice>
      </div>

      <ActionForm action={salvarCotacaoAction} className="mt-4" noticePosition="bottom">
        <Field
          label={copy.rateField}
          name="rate"
          inputMode="decimal"
          required
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="5,1000"
        />

        {exemplo ? (
          <p className="mt-2 text-xs leading-relaxed text-ash">
            {formatAdminMessage(copy.rateExample, { example: exemplo })}
          </p>
        ) : null}

        <div className="mt-4">
          <SubmitButton tone="secondary" pendingLabel={content.common.saving}>
            {copy.rateSave}
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
