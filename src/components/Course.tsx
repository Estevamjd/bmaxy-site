import { Plus } from "@/components/icons";
import {
  ButtonGhost,
  ButtonPrimary,
  PlusCorners,
  SectionEyebrow,
} from "@/components/ui";
import type { SiteContent } from "@/content/site";
import { revealDelay } from "@/lib/reveal";

/**
 * Mockup de player, 100% HTML/CSS — sem nenhuma imagem (nunca houve frame
 * real da aula 1, e um placeholder fingindo ser um quadro de vídeo é
 * exatamente o tipo de conteúdo enganoso que este bloco existe pra evitar).
 * Sem vídeo aprovado ainda: não é um link, não tem cursor de clique, não
 * tem botão de play nem barra de progresso — nada aqui pode parecer ou
 * afirmar que reproduz alguma coisa. Quando o vídeo chegar, volta a virar
 * um <Link> com o botão de play de verdade (e aí sim uma imagem real de
 * capa faz sentido).
 */
function PlayerMockup({ course }: { course: SiteContent["course"] }) {
  const { player } = course;

  return (
    <div className="relative">
      <PlusCorners tone="gold" />

      <div className="border border-line bg-deep-surface">
        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-void">
          {/* Tarja: o gancho comercial da página */}
          <span
            aria-hidden="true"
            className="absolute left-0 top-6 bg-gold px-4 py-2.5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-void md:top-8 md:px-5 md:text-xs"
          >
            {player.badge}
          </span>

          {/* Marcação neutra de "sem vídeo ainda" — sem forma de play, sem
              gradiente de destaque, para não parecer um botão. */}
          <span
            aria-hidden="true"
            className="flex items-center gap-2 border border-white/30 px-4 py-2.5 font-sans text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-white/90"
          >
            <Plus className="h-3 w-3 shrink-0" />
            {player.statusLabel}
          </span>
        </div>

        {/* Barra inferior do player — sem progresso, porque nada foi assistido */}
        <div className="border-t border-line px-5 py-5 md:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <p className="label-eyebrow text-gold">{player.lessonNumber}</p>
              <p className="mt-2 truncate text-[0.9375rem] text-white md:text-base">
                {player.lessonTitle}
              </p>
            </div>
            <p className="label-eyebrow shrink-0 text-ash">
              {player.statusLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Course({ site }: { site: SiteContent }) {
  const { course } = site;

  return (
    <section id="curso" className="section-y bg-void">
      <div className="container-site">
        <div className="grid gap-16 lg:grid-cols-12 lg:items-start lg:gap-x-14 xl:gap-x-20">
          {/* ------------------------------- esquerda ------------------------------ */}
          <div className="lg:col-span-6">
            <SectionEyebrow index={course.index} label={course.label} />

            <h2
              className="display t-course mt-6 text-white"
              data-reveal
              style={revealDelay(0)}
            >
              {course.title}
            </h2>

            <p className="label-eyebrow mt-6 text-gold">{course.subtitle}</p>

            <p className="measure mt-8 text-[1.0625rem] leading-relaxed text-ash md:text-lg">
              {course.description}
            </p>

            <div className="mt-12 border-t border-line pt-8">
              <p className="label-eyebrow text-ash">{course.topicsLabel}</p>
              <ul className="mt-6 space-y-4">
                {course.topics.map((topic, index) => (
                  <li
                    key={topic}
                    className="flex items-start gap-4"
                    data-reveal
                    style={revealDelay(index)}
                  >
                    <Plus className="mt-[0.4rem] h-3 w-3 shrink-0 text-gold" />
                    <span className="text-[1.0625rem] leading-relaxed text-white/90">
                      {topic}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-12 border-t border-line pt-8">
              {/* Aqui ficava o preço em destaque tipográfico ("R$ 349" grande,
                  "ou US$ 99" ao lado). Saiu porque o cliente confirmou que os
                  valores das duas modalidades ainda não foram definidos —
                  exibi-los como fechados era a única informação inventada que
                  restava nesta página. No lugar entram as duas modalidades
                  reais, cada uma marcada como "Em breve", sem número nenhum. */}
              <h3 className="label-eyebrow text-ash">{course.plansLabel}</h3>
              <ul className="mt-5 space-y-4">
                {course.plans.map((plan) => (
                  <li key={plan.name} className="border-t border-line pt-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="display text-[1.125rem] leading-tight text-white md:text-[1.25rem]">
                        {plan.name}
                      </p>
                      <span className="shrink-0 border border-gold/40 px-2.5 py-1 font-sans text-[0.625rem] font-medium uppercase tracking-[0.16em] text-gold">
                        {plan.statusLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ash">{plan.text}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-ash">{course.priceNote}</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonPrimary href={course.cta.href}>
                  {course.cta.label}
                </ButtonPrimary>
                <ButtonGhost href={course.secondaryCta.href}>
                  {course.secondaryCta.label}
                </ButtonGhost>
              </div>
            </div>
          </div>

          {/* -------------------------------- direita ------------------------------ */}
          <div className="lg:col-span-6">
            <div data-reveal style={revealDelay(1)}>
              <PlayerMockup course={course} />
            </div>

            <div
              className="relative mt-10 border border-line p-6 md:p-8"
              data-reveal
              style={revealDelay(2)}
            >
              <PlusCorners tone="gold" />
              <p className="display text-[1.375rem] leading-tight text-gold md:text-[1.625rem]">
                {course.freeHighlight}
              </p>
              <p className="measure mt-4 text-[0.9375rem] leading-relaxed text-ash md:text-base">
                {course.freeDetail}
              </p>
            </div>

            {/* O caminho do aluno, do vídeo grátis ao acesso liberado aula a
                aula. É a mecânica que decide a compra, então fica visível. */}
            <div className="mt-12" data-reveal style={revealDelay(3)}>
              <p className="label-eyebrow text-ash">{course.howItWorks.label}</p>
              <ol className="mt-6">
                {course.howItWorks.steps.map((step) => (
                  <li
                    key={step.number}
                    className="grid grid-cols-[auto_1fr] gap-x-5 border-t border-line py-5 last:border-b"
                  >
                    <span className="label-eyebrow pt-1 text-gold">
                      {step.number}
                    </span>
                    <div>
                      <h3 className="display text-[1.0625rem] text-white md:text-[1.125rem]">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ash">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
