import { Lock, Plus } from "@/components/icons";
import PageIntro from "@/components/pages/PageIntro";
import { ButtonPrimary, PlusCorners, SectionEyebrow } from "@/components/ui";
import type { Locale, SiteContent } from "@/content/site";
import { revealDelay } from "@/lib/reveal";

/**
 * `/curso` e `/en/course`.
 *
 * SÓ DADOS CONFIRMADOS. O que está aqui: duas modalidades de acesso
 * (tempo limitado e vitalícia), certificado de
 * conclusão, aula 1 gratuita depois do cadastro, aula seguinte liberada ao
 * concluir a anterior, primeira aula a ser regravada e checkout indisponível.
 *
 * NÃO HÁ PREÇO NESTA PÁGINA, e é deliberado. Ela já exibiu "R$ 349 / US$ 99"
 * em destaque tipográfico; o cliente confirmou depois que os valores das duas
 * modalidades ainda não foram definidos. Não reintroduza valor, moeda,
 * desconto nem duração do plano limitado sem confirmação escrita.
 *
 * O QUE TAMBÉM NÃO ESTÁ, e não deve voltar sem confirmação: critérios de
 * emissão do certificado, prazo de lançamento, número de alunos, e qualquer
 * botão que pareça um checkout funcionando.
 *
 * O bloco "situação hoje" fica ANTES das modalidades de propósito: quem chega
 * aqui precisa saber que não dá pra comprar antes de ler o que será vendido.
 */
export default function CoursePage({
  site,
  locale,
}: {
  site: SiteContent;
  locale: Locale;
}) {
  const page = site.pages.course;
  const { course } = site;

  return (
    <>
      <PageIntro
        site={site}
        locale={locale}
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.lead}
      />

      {/* --------------------------- números ------------------------------- */}
      <section className="bg-void pb-16 pt-12 md:pb-24 md:pt-16">
        <div className="container-site">
          <h2 className="label-eyebrow text-ash">{page.factsLabel}</h2>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3 md:gap-x-12">
            {page.facts.map((fact, index) => (
              <div
                key={fact.label}
                className="relative flex flex-col-reverse border-t border-line pt-7"
                data-reveal
                style={revealDelay(index, 70)}
              >
                <Plus className="absolute -left-[7px] -top-[7px] h-3.5 w-3.5 text-gold" />
                <dt className="label-eyebrow mt-3 text-ash">{fact.label}</dt>
                <dd className="display t-price text-white">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 text-sm text-ash">{course.priceNote}</p>
        </div>
      </section>

      {/* ----------------------- situação hoje ----------------------------- */}
      <section className="bg-void pb-16 md:pb-24">
        <div className="container-site">
          <div className="relative border border-gold/40 bg-gold/[0.06] p-8 md:p-10">
            <PlusCorners tone="gold" />
            <p className="label-eyebrow flex items-center gap-3 text-gold">
              <Lock className="h-4 w-4 shrink-0" />
              {page.statusLabel}
            </p>
            <h2 className="display mt-5 text-[1.5rem] leading-tight text-white md:text-[2rem]">
              {page.statusTitle}
            </h2>
            <p className="measure mt-5 text-[1.0625rem] leading-relaxed text-white/85">
              {page.statusText}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------ modalidades de acesso -------------------- */}
      {/* Duas modalidades confirmadas pelo cliente, SEM preço e SEM duração —
          os dois ainda não foram definidos. Cada card é um <div>, nunca um
          link ou botão: nada aqui pode parecer um checkout que funciona. */}
      <section className="bg-void pb-16 md:pb-24">
        <div className="container-site">
          <SectionEyebrow as="h2" label={course.plansLabel} tone="deep" />

          <ul className="mt-10 grid gap-6 md:mt-12 md:grid-cols-2 md:gap-8">
            {course.plans.map((plan, index) => (
              <li
                key={plan.name}
                className="relative border border-line p-7 md:p-8"
                data-reveal
                style={revealDelay(index, 70)}
              >
                <PlusCorners tone="gold" />
                <span className="inline-flex items-center border border-gold/40 px-2.5 py-1 font-sans text-[0.625rem] font-medium uppercase tracking-[0.16em] text-gold">
                  {plan.statusLabel}
                </span>
                <h3 className="display mt-5 text-[1.375rem] leading-tight text-white md:text-[1.625rem]">
                  {plan.name}
                </h3>
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-ash md:text-base">
                  {plan.text}
                </p>
              </li>
            ))}
          </ul>

          <p className="measure mt-8 text-sm leading-relaxed text-ash">
            {course.plansNote}
          </p>
        </div>
      </section>

      {/* ---------------------------- certificado -------------------------- */}
      {/* O certificado FOI confirmado; os critérios de emissão NÃO. O texto
          diz exatamente isso — prometer "assista 100% e receba" seria inventar
          uma regra que o cliente ainda não definiu. */}
      <section className="bg-void pb-16 md:pb-24">
        <div className="container-site">
          <div className="relative border border-line p-8 md:p-10">
            <PlusCorners tone="gold" />
            <p className="label-eyebrow text-gold">{course.certificateLabel}</p>
            <h2 className="display mt-5 text-[1.5rem] leading-tight text-white md:text-[1.875rem]">
              {course.certificateTitle}
            </h2>
            <p className="measure mt-5 text-[1.0625rem] leading-relaxed text-ash">
              {course.certificateText}
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------- conteúdo ------------------------------ */}
      <section className="section-y bg-bone pt-0 text-ink">
        <div className="container-site">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionEyebrow as="h2" label={course.topicsLabel} tone="light" />
              <p className="measure mt-6 text-[1.0625rem] leading-relaxed text-ink-soft md:text-lg">
                {course.description}
              </p>
            </div>

            <ul className="lg:col-span-6 lg:col-start-7">
              {course.topics.map((topic, index) => (
                <li
                  key={topic}
                  className="flex items-start gap-4 border-t border-line-light py-5 last:border-b"
                  data-reveal
                  style={revealDelay(index, 60)}
                >
                  <Plus className="mt-1.5 h-3 w-3 shrink-0 text-royal" />
                  <span className="text-[1.0625rem] leading-relaxed text-ink">
                    {topic}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------- como o acesso funciona ------------------- */}
      <section className="section-y bg-deep-surface">
        <div className="container-site">
          <SectionEyebrow as="h2" label={page.accessLabel} tone="deep" />

          <ol className="mt-12 md:mt-16">
            {page.accessSteps.map((step, index) => (
              <li
                key={step.number}
                className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-white/15 py-7 last:border-b md:grid-cols-12 md:gap-x-8 md:py-9"
                data-reveal
                style={revealDelay(index, 70)}
              >
                <span className="label-eyebrow pt-1.5 text-gold md:col-span-2">
                  {step.number}
                </span>
                <h3 className="display text-[1.375rem] leading-tight text-white md:col-span-4 md:text-[1.625rem]">
                  {step.title}
                </h3>
                <p className="col-start-2 mt-3 text-[0.9375rem] leading-relaxed text-white/75 md:col-span-6 md:col-start-7 md:mt-0 md:text-base">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>

          {/* Aula 1: só texto, sem imagem e sem forma de play — não existe
              vídeo aprovado, e um botão de play falso seria mentira visual.
              Ver a mesma decisão em Course.tsx (bloco da home). */}
          <div className="relative mt-14 border border-white/20 p-8 md:mt-16 md:p-10">
            <PlusCorners tone="gold" />
            <p className="label-eyebrow text-gold">{course.player.lessonNumber}</p>
            <p className="display mt-4 text-[1.375rem] leading-tight text-white md:text-[1.75rem]">
              {course.player.lessonTitle}
            </p>
            {/* Só texto: sem imagem, sem botão de play, sem barra de
                progresso — não há vídeo, e nada aqui pode sugerir que há. */}
            <p className="mt-6 inline-flex items-center gap-2 border border-white/30 px-4 py-2.5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-white/90">
              <Plus className="h-3 w-3 shrink-0" />
              {course.player.statusLabel}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------- cadastro ----------------------------- */}
      <section className="section-y bg-void">
        <div className="container-site">
          <div className="relative border border-line p-8 md:p-12">
            <PlusCorners tone="gold" />
            <p className="display text-[1.5rem] leading-tight text-gold md:text-[2rem]">
              {course.freeHighlight}
            </p>
            <p className="measure mt-5 text-[1.0625rem] leading-relaxed text-ash md:text-lg">
              {course.freeDetail}
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <ButtonPrimary href={page.signupCta.href}>
                {page.signupCta.label}
              </ButtonPrimary>
              <p className="measure text-sm text-ash">{page.signupNote}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
