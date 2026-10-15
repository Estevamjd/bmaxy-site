/**
 * =============================================================================
 *  BMAXY LLC — conteúdo único do site
 * =============================================================================
 *
 *  REGRA DO PROJETO: nenhuma string escrita dentro de JSX.
 *  Todo texto e todo caminho de imagem vive aqui. Para trocar o conteúdo do
 *  site inteiro, edite apenas este arquivo — nenhum componente muda.
 *
 *  BILÍNGUE (ligado):
 *  `siteContent = { pt, en }`, os dois com o MESMO formato `SiteContent`.
 *  Nenhum componente importa `site` diretamente — todos recebem o objeto
 *  certo via prop, a partir de `siteContent.pt` ou `siteContent.en`:
 *
 *    - src/app/(pt)/page.tsx e src/app/en/page.tsx passam `site` para
 *      HomeSections, que distribui para cada seção da home.
 *    - src/app/(pt)/layout.tsx e src/app/en/layout.tsx passam `site` para
 *      AppShell, que distribui para Header/Footer/StructuredData.
 *
 *  "/" (sem prefixo) é português, o idioma padrão do site. "/en" é inglês.
 *  TODAS as páginas públicas existem nos dois idiomas — home, `/sobre`,
 *  `/livros` (catálogo e página de cada livro), `/consultoria`,
 *  `/ghostwriting` e `/curso`. Os caminhos de cada idioma vivem numa tabela
 *  só, em `src/lib/routes.ts`; NUNCA escreva "/en/about" na mão aqui — use
 *  `pagePath("about", "en")`, senão o menu, o seletor PT/EN e o hreflang
 *  passam a discordar entre si na primeira mudança.
 *
 *  A exceção conhecida é a PLATAFORMA (`/entrar`, `/cadastro`, `/aluno`,
 *  `/admin`): só existe em português nesta etapa, e os dois idiomas apontam
 *  para a mesma rota.
 *
 *  Procure por `TODO: conteúdo real do cliente` para achar tudo o que é texto
 *  provisório aguardando material verdadeiro.
 * =============================================================================
 */

import { bookPath, pagePath } from "@/lib/routes";

export type Locale = "pt" | "en";

/* --------------------------------- tipos --------------------------------- */

export type Link = {
  label: string;
  href: string;
  /** true = abre em nova aba e recebe o ícone de link externo */
  external?: boolean;
};

export type Media = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

/**
 * Consultoria e ghostwriting são a MESMA página com conteúdo diferente —
 * mesmo esqueleto, mesma ordem de blocos, mesma tipografia. Um tipo só e um
 * componente só (`ServicePage`), duas entradas de conteúdo.
 *
 * `pending` existe porque nenhum dos dois serviços tem formato, prazo ou
 * preço fechados: em vez de inventar números, a página DIZ o que ainda não
 * está definido e manda a pessoa perguntar por e-mail.
 */
export type ServicePageContent = {
  eyebrow: string;
  title: string;
  lead: string;
  paragraphs: string[];
  stepsLabel: string;
  steps: { number: string; title: string; text: string }[];
  pendingLabel: string;
  pendingIntro: string;
  pendingItems: string[];
  ctaLabel: string;
  ctaNote: string;
  portrait: Media;
};

export type SiteContent = {
  meta: {
    company: string;
    domain: string;
    url: string;
    tagline: string;
    title: string;
    titleTemplate: string;
    description: string;
    keywords: string[];
    ogAlt: string;
    locale: string;
    authorName: string;
    authorJobTitle: string;
    authorSameAs: string[];
  };
  a11y: {
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    mainNavLabel: string;
    footerNavLabel: string;
    externalLinkHint: string;
    /** Nome acessível do link do seletor PT/EN — descreve o idioma de DESTINO. */
    switchToLanguage: string;
  };
  brand: {
    /** Escrito como texto vivo em Archivo, nunca como imagem. */
    wordmark: string;
    taglineInline: string;
    mark: Media;
  };
  nav: Link[];
  /** O curso é fechado por login: o cliente entrega usuário e senha depois do
   *  pagamento. A porta de entrada precisa existir no header desde já. */
  studentArea: Link;
  studentAreaShort: string;
  /** Porta de entrada do cadastro. A rota é a mesma nos dois idiomas — a
   *  plataforma ainda não é bilíngue; só o rótulo muda. */
  signupLink: Link;
  headerCta: Link;
  /** Versão curta do botão do topo — abaixo de 640px o rótulo cheio não cabe
   *  ao lado da marca e do menu, e esconder o CTA no celular custa caro. */
  headerCtaShort: string;
  hero: {
    label: string;
    /** Quebras de linha manuais — cada item é uma linha do h1. */
    titleLines: string[];
    paragraph: string;
    primaryCta: Link;
    secondaryCta: Link;
    scrollHint: string;
    portrait: Media;
  };
  /**
   * Seção de CAMINHOS — a primeira coisa depois do hero.
   *
   * Existe porque o site tinha uma porta principal bloqueada ("Aula 1 em
   * breve") e nenhuma pergunta feita ao visitante. Aqui ele escolhe pela
   * INTENÇÃO dele — escrever sozinho, aprender pelo curso, ou entregar a
   * história para alguém escrever — e não pelo nome comercial do serviço.
   *
   * REGRA DE ESCRITA: o texto de apoio precisa funcionar para quem nunca ouviu
   * "ghostwriting" nem "consultoria literária". Nenhum dos três textos pode
   * depender de o visitante já conhecer o jargão. Se um dia alguém reescrever
   * isso usando o nome do serviço como explicação, a seção perde a razão de
   * existir.
   *
   * `note` carrega a informação da aula 1 gratuita, que saiu do CTA do hero.
   * Ela NÃO pode ser apagada nem suavizada: diz que é grátis E que ainda não
   * está no ar. As duas metades andam juntas.
   */
  paths: {
    /** id do <section> — é a âncora para onde o CTA principal do hero aponta. */
    anchor: string;
    index: string;
    label: string;
    title: string;
    lead: string;
    items: {
      number: string;
      /** A frase na voz do visitante: "Quero…" / "I want…". */
      title: string;
      text: string;
      cta: Link;
    }[];
    note: string;
    noteCta: Link;
  };
  marquee: {
    items: string[];
    separator: string;
    pauseLabel: string;
    playLabel: string;
  };
  stats: {
    label: string;
    items: { value: string; label: string }[];
  };
  services: {
    index: string;
    label: string;
    title: string;
    items: {
      number: string;
      title: string;
      description: string;
      href: string;
    }[];
  };
  books: {
    index: string;
    label: string;
    title: string;
    intro: string;
    /** Explica que físico/Kindle saem do site e que o eBook é vendido aqui. */
    note: string;
    /**
     * Contexto para o leitor de inglês: os títulos continuam em português
     * porque são os nomes OFICIAIS das obras. `null` em português, onde a
     * observação não faz sentido nenhum.
     *
     * NÃO troque por "Portuguese-language edition": o idioma da EDIÇÃO não
     * está confirmado, só o do título. Também não invente título em inglês —
     * isso sugeriria existir uma tradução publicada, que não existe.
     */
    titleNote: string | null;
    /** Nota de moeda, conversão aproximada ou regra de preço exibida. */
    priceNote: string | null;
    formatsLabel: string;
    priceLabels: { print: string; ebook: string };
    /**
     * NÃO EXISTE MAIS UM `items` AQUI, e a ausência é o ponto.
     *
     * Título, sinopse, preço, capa e links de loja vivem no banco e são
     * editados no painel (`/admin/livros`). O que sobrou neste bloco é COPY
     * do site — o título da seção, a chamada, a nota de onde se compra —, que
     * não muda quando um livro entra ou sai do catálogo.
     *
     * Manter as duas coisas juntas era o convite para elas discordarem: quem
     * editasse a lista aqui não veria efeito nenhum na vitrine, e quem lesse
     * este arquivo acharia que estava vendo o catálogo. Os livros chegam aos
     * componentes por prop, vindos de `src/lib/dal/catalog.ts`.
     */
    allBooks: Link;
  };
  course: {
    index: string;
    label: string;
    title: string;
    subtitle: string;
    description: string;
    topicsLabel: string;
    topics: string[];
    /** A mecânica que o cliente descreveu: assiste grátis → paga no site →
     *  as aulas abrem uma a uma. Precisa estar visível na home. */
    howItWorks: {
      label: string;
      steps: { number: string; title: string; text: string }[];
    };
    /**
     * NÃO existe preço aqui, e não é esquecimento.
     *
     * O site já exibiu "R$ 349 / US$ 99" como valor fechado. O cliente
     * confirmou depois que os preços das duas modalidades AINDA NÃO FORAM
     * DEFINIDOS — então aquele número não podia continuar no ar. Não
     * reintroduza valor, moeda, desconto ou duração sem confirmação escrita.
     */
    priceNote: string;
    /** Duas modalidades confirmadas; preço e duração de cada uma, não. */
    plansLabel: string;
    plansNote: string;
    plans: { name: string; text: string; statusLabel: string }[];
    /** Existe certificado; os critérios de emissão ainda não existem. */
    certificateLabel: string;
    certificateTitle: string;
    certificateText: string;
    freeHighlight: string;
    freeDetail: string;
    cta: Link;
    secondaryCta: Link;
    /** Mockup em HTML/CSS puro — sem imagem, ver Course.tsx. Nenhum arquivo
     *  de poster/placeholder: enquanto não há vídeo aprovado, o bloco só
     *  mostra texto (número da aula, título, estado "em breve"). */
    player: {
      badge: string;
      lessonNumber: string;
      lessonTitle: string;
      /** Estado exibido no lugar do play/progresso enquanto não há vídeo. */
      statusLabel: string;
    };
  };
  about: {
    index: string;
    label: string;
    title: string;
    paragraphs: string[];
    cta: Link;
    portrait: Media;
  };
  /** Sem depoimentos reais e autorizados ainda — nenhum campo aqui até que
   *  existam. Não reintroduza nomes/falas fictícias "só pra preencher". */
  /**
   * O PROCESSO EDITORIAL, da ideia ao livro publicado — quatro etapas.
   *
   * Esta seção JÁ FOI uma composição de fotografias (um retrato grande e dois
   * recortes). Saiu inteira e não deve voltar: as três imagens eram as mesmas
   * que já aparecem no hero e nas páginas de serviço, os recortes existiam
   * para preencher espaço e nenhuma delas explicava o que a BMaxy faz. Hoje a
   * seção é PURAMENTE TIPOGRÁFICA — numeração, filetes, hierarquia.
   *
   * SE UM DIA ENTRAR UMA FOTO AQUI: no máximo uma, e só se (a) não repetir
   * nenhuma outra da mesma página e (b) mostrar de fato uma das quatro etapas.
   * Nenhuma das quatro fotos que existem hoje em /public/people cumpre as
   * duas coisas — por isso não há campo de imagem neste tipo.
   *
   * A FAIXA DO INSTAGRAM continua no fim, e continua sendo só um link: @
   * verdadeiro, uma linha de texto e o botão. Nada de curtidas, comentários,
   * datas, legendas, alcance ou depoimento — nada disso foi fornecido, e
   * inventar seria o mesmo problema dos depoimentos fictícios que já saíram
   * do site.
   */
  behind: {
    index: string;
    label: string;
    title: string;
    lead: string;
    stagesLabel: string;
    stages: { number: string; title: string; text: string }[];
    handleLabel: string;
    handle: string;
    /** Uma linha, factual. Não descreve o que é postado lá. */
    socialText: string;
    href: string;
    cta: string;
  };

  /**
   * Páginas internas. Todas existem nos dois idiomas; os caminhos vêm de
   * `src/lib/routes.ts`, nunca escritos à mão.
   */
  pages: {
    common: {
      /** Rótulo do <nav> de volta no topo de cada página interna. */
      breadcrumbLabel: string;
      backToHome: string;
    };
    about: {
      eyebrow: string;
      title: string;
      lead: string;
      portrait: Media;
      storyLabel: string;
      rolesLabel: string;
      roles: { number: string; title: string; text: string }[];
      mission: { label: string; title: string; paragraphs: string[] };
      booksCta: Link;
      contactLabel: string;
      contactNote: string;
      contactCta: string;
    };
    books: {
      eyebrow: string;
      title: string;
      lead: string;
      /** Rótulo do link em cada capa/título — "Ver o livro". */
      detailCta: string;
    };
    bookDetail: {
      eyebrow: string;
      /** Versão no singular de `books.titleNote`. `null` em português. */
      titleNote: string | null;
      synopsisLabel: string;
      pricesLabel: string;
      whereToBuyLabel: string;
      /** Diz, sem rodeio, que a compra acontece fora do site. */
      externalNotice: string;
      backToCatalog: string;
      otherBooksLabel: string;
      /** Prefixo da description da página do livro, antes da sinopse. */
      metaPrefix: string;
    };
    consulting: ServicePageContent;
    ghostwriting: ServicePageContent;
    course: {
      eyebrow: string;
      title: string;
      lead: string;
      factsLabel: string;
      facts: { value: string; label: string }[];
      accessLabel: string;
      accessSteps: { number: string; title: string; text: string }[];
      /** Bloco honesto: checkout ainda não existe. */
      statusLabel: string;
      statusTitle: string;
      statusText: string;
      signupCta: Link;
      signupNote: string;
    };
  };
  newsletter: {
    label: string;
    title: string;
    description: string;
    emailLabel: string;
    emailPlaceholder: string;
    submit: string;
    success: string;
    invalid: string;
    legal: string;
  };
  footer: {
    wordmark: string;
    columns: {
      title: string;
      links: Link[];
    }[];
    contact: {
      title: string;
      email: string;
      lines: string[];
    };
    copyright: string;
    legal: Link[];
  };
};

/* ------------------------------- português ------------------------------- */

const pt: SiteContent = {
  meta: {
    company: "BMAXY LLC",
    domain: "bmaxy.com",
    url: "https://bmaxy.com",
    tagline: "Escrever, ensinar, transformar",
    title: "BMaxy — Rodrigo Gambini | Escrever, ensinar, transformar",
    titleTemplate: "%s — BMaxy",
    description:
      "Livros, consultoria, ghostwriting e o curso Seu Livro, com Rodrigo Gambini. Escritor brasileiro nos Estados Unidos. A primeira aula do curso é gratuita.",
    keywords: [
      "Rodrigo Gambini",
      "BMaxy",
      "como escrever um livro",
      "curso de escrita",
      "ghostwriting",
      "consultoria literária",
      "publicar livro",
      "escritor brasileiro",
    ],
    ogAlt: "BMaxy — Rodrigo Gambini. Escrever, ensinar, transformar.",
    locale: "pt_BR",
    authorName: "Rodrigo Gambini",
    authorJobTitle:
      "Escritor, consultor literário, ghostwriter e produtor audiovisual",
    authorSameAs: [
      "https://instagram.com/eurodrigogambini",
      "https://tiktok.com/@eurodrigogambini",
      "https://x.com/rogambini",
      "https://www.threads.net/@eurodrigogambini",
    ],
  },

  a11y: {
    skipToContent: "Pular para o conteúdo",
    openMenu: "Abrir menu de navegação",
    closeMenu: "Fechar menu de navegação",
    mainNavLabel: "Navegação principal",
    footerNavLabel: "Navegação do rodapé",
    externalLinkHint: "(abre em nova aba)",
    switchToLanguage: "Ver o site em inglês",
  },

  brand: {
    wordmark: "BMAXY",
    taglineInline: "Escrever · Ensinar · Transformar",
    mark: {
      // Símbolo isolado (B + pena + livro), redesenhado em vetor para funcionar
      // a 40px sobre fundo escuro. Substituir pelo SVG oficial quando o cliente
      // enviar — ver comentário em src/components/BrandMark.tsx.
      src: "/brand/bmaxy-mark.svg",
      alt: "Símbolo BMaxy: a letra B com uma pena dourada escrevendo sobre um livro aberto",
      width: 96,
      height: 96,
    },
  },

  nav: [
    { label: "Sobre", href: pagePath("about", "pt") },
    { label: "Livros", href: pagePath("books", "pt") },
    { label: "Consultoria", href: pagePath("consulting", "pt") },
    { label: "Ghostwriting", href: pagePath("ghostwriting", "pt") },
    { label: "Curso", href: pagePath("course", "pt") },
  ],

  studentArea: { label: "Área do aluno", href: "/entrar" },
  studentAreaShort: "Entrar",
  signupLink: { label: "Criar conta", href: "/cadastro" },

  // O botão do topo dizia "Aula 1 em breve" — uma ação BLOQUEADA ocupando o
  // lugar mais visível do site. A informação não sumiu (ela vive em
  // `paths.note` e em `course.freeHighlight`), mas parou de ser a porta de
  // entrada: quem chega agora é convidado a CONHECER o curso, que é uma
  // página real, com conteúdo real e nada prometido para depois.
  headerCta: { label: "Conhecer o curso", href: pagePath("course", "pt") },
  headerCtaShort: "Curso",

  hero: {
    label: "Escrever, ensinar, transformar",
    // Quebras manuais para desktop, pedidas pelo cliente. "tem uma história"
    // é a linha mais longa (16 caracteres com espaço) — mais longa que
    // qualquer linha do título anterior. Em telas estreitas ela quebra
    // sozinha em duas (text-wrap: balance, na classe `display`): não é
    // preciso um array separado para mobile. Testado em 320/375/768/1440px —
    // ver nota de validação no relatório da tarefa.
    titleLines: ["Todo mundo", "tem uma história", "pra contar"],
    paragraph:
      "Sou Rodrigo Gambini, escritor brasileiro vivendo nos Estados Unidos. Publico meus livros, ensino pessoas a escreverem seu primeiro livro e escrevo para quem tem uma história para contar, mas não tem tempo de colocá-la no papel.",
    // O CTA principal era "Aula 1 em breve": a porta de entrada do site era
    // uma coisa que ainda não dá para fazer. Agora ele leva à seção de
    // caminhos, logo abaixo — a pergunta que o visitante realmente tem.
    // A âncora é `#${paths.anchor}`, que muda por idioma.
    primaryCta: { label: "Começar meu livro", href: "#caminhos" },
    secondaryCta: { label: "Ver os livros", href: pagePath("books", "pt") },
    scrollHint: "Role",
    portrait: {
      src: "/people/rodrigo-hero.png",
      alt: "Retrato de Rodrigo Gambini sentado à mesa, escrevendo em um caderno, com uma pilha de livros ao lado",
      width: 1023,
      height: 1537,
    },
  },

  paths: {
    anchor: "caminhos",
    index: "00/",
    label: "Por onde começar",
    title: "Como você quer transformar sua história em livro?",
    lead: "Três formas de chegar no mesmo lugar. A diferença está em quem escreve — e em quanto tempo você tem.",
    items: [
      {
        number: "01",
        title: "Quero escrever meu próprio livro",
        // "Consultoria literária" é jargão: quem nunca contratou uma não sabe
        // o que compra. A frase explica o serviço sem usar o nome dele.
        text: "Você escreve, no seu texto e na sua voz. Rodrigo lê o que você já tem, aponta o que está funcionando, o que precisa de outra volta e o que vem depois — do primeiro parágrafo até o arquivo pronto para publicar.",
        cta: { label: "Conhecer a consultoria", href: pagePath("consulting", "pt") },
      },
      {
        number: "02",
        title: "Quero aprender pelo curso",
        text: "Aulas em vídeo que ensinam o caminho inteiro, passo a passo: encontrar a história, montar a estrutura, escrever, revisar e publicar. Você assiste no seu ritmo, quantas vezes precisar, sem ninguém esperando por você.",
        cta: { label: "Conhecer o curso Seu Livro", href: pagePath("course", "pt") },
      },
      {
        number: "03",
        title: "Quero que escrevam por mim",
        // "Ghostwriting" idem: a frase precisa se explicar sozinha para quem
        // nunca ouviu a palavra.
        text: "Você conta a sua história e Rodrigo a transforma em livro. Você não precisa escrever nada: lê cada capítulo, corrige, aprova. Na capa aparece o seu nome, sozinho.",
        cta: { label: "Conhecer o ghostwriting", href: pagePath("ghostwriting", "pt") },
      },
    ],
    // A informação que saiu do CTA do hero. As duas metades andam juntas: é
    // gratuita E ainda não está no ar. Tirar a segunda faz virar promessa.
    note: "A aula 1 do curso será gratuita. Ela ainda está sendo regravada — quando entrar no ar, você assiste inteira sem pagar nada e sem cadastrar cartão.",
    noteCta: { label: "Ver como o curso funciona", href: pagePath("course", "pt") },
  },

  marquee: {
    items: ["Livros", "Consultoria", "Ghostwriting", "Curso Seu Livro"],
    separator: "·",
    pauseLabel: "Pausar a faixa animada",
    playLabel: "Retomar a faixa animada",
  },

  stats: {
    label: "Em números",
    // Só entram métricas verificáveis: 32 veio do cliente; 6 é a quantidade
    // real de títulos exibidos no catálogo; 3 corresponde aos caminhos
    // apresentados na seção 00/; e o site/atendimento operam em 2 idiomas.
    // Não exibimos contagem de aulas/gravadas sem aprovação documental.
    // NÃO acrescente "pessoas alcançadas", "famílias impactadas", número de
    // alunos, notas de avaliação nem percentuais: nada disso tem comprovação.
    // Stats.tsx redistribui a grade sozinho (2 colunas no mobile/tablet,
    // 4 no desktop) a partir da quantidade de itens deste array.
    items: [
      { value: "32", label: "Livros publicados" },
      { value: "6", label: "Livros em destaque" },
      { value: "3", label: "Caminhos para publicar" },
      { value: "2", label: "Idiomas de atendimento" },
    ],
  },

  services: {
    index: "01/",
    label: "Serviços",
    // Era "Quatro caminhos". Trocou porque a seção 00/ passou a se chamar
    // justamente "caminhos" e a fazer a pergunta que orienta a escolha —
    // duas seções com o mesmo nome na mesma página anulavam as duas.
    // Esta aqui é o catálogo completo do que existe, inclusive os livros.
    title: "O que a BMaxy faz",
    items: [
      {
        number: "001",
        title: "Livros",
        description:
          "Meus títulos em papel e em eBook. Comece por onde a sua estante pedir.",
        href: pagePath("books", "pt"),
      },
      {
        number: "002",
        title: "Consultoria",
        // TODO: conteúdo real do cliente — formato, duração e preço da consultoria.
        description:
          "Você escreve, eu mostro o caminho. Acompanhamento do primeiro parágrafo ao arquivo final.",
        href: pagePath("consulting", "pt"),
      },
      {
        number: "003",
        title: "Ghostwriting",
        // TODO: conteúdo real do cliente — escopo, prazo e faixa de investimento.
        description:
          "Você conta a história, eu escrevo o livro. A assinatura na capa é sua, e só sua.",
        href: pagePath("ghostwriting", "pt"),
      },
      {
        number: "004",
        title: "Curso",
        description:
          "Aulas em vídeo para tirar o livro da cabeça e colocá-lo no mundo. A primeira é gratuita.",
        href: pagePath("course", "pt"),
      },
    ],
  },

  books: {
    index: "02/",
    label: "Biblioteca",
    title: "Os livros",
    intro:
      "Suspense psicológico, drama humano, desenvolvimento pessoal. Seis dos 32 títulos publicados — comece por onde a sua estante pedir.",
    note: "Impresso e Kindle abrem na loja parceira (Amazon ou Clube de Autores). A venda do eBook direto pelo site ainda não está disponível.",
    // Só a versão em inglês precisa dizer isso — ver o comentário no tipo.
    titleNote: null,
    priceNote: null,
    formatsLabel: "Onde comprar",
    priceLabels: { print: "Impresso", ebook: "eBook" },
    // Títulos e preços vêm do catálogo real no Clube de Autores. Os dois
    // primeiros são os únicos com edição digital, por isso abrem a grade.
    // Ordem e links de compra são os definidos pelo cliente — não reordenar
    // nem recombinar capa/título/link sem conferir os seis contra o pedido.
    allBooks: { label: "Ver todos os livros", href: pagePath("books", "pt") },
  },

  course: {
    index: "03/",
    label: "Curso",
    title: "Seu Livro",
    // "Acesso vitalício" já esteve PROIBIDO neste arquivo, porque o cliente
    // não havia confirmado o modelo. Ele confirmou depois, junto com o plano
    // de tempo limitado — e a modalidade passou a aparecer em `plans`, sempre
    // marcada como "Em breve", sem preço e sem duração.
    //
    // O que continua valendo: nada aqui pode virar promessa vendável antes de
    // o cliente definir preço, moeda e o que "vitalício" significa (vitalício
    // em relação a quê?). Essa é a promessa que não dá para desdizer depois.
    // O subtítulo abaixo fica só com o que é fato hoje.
    subtitle: "Aulas em vídeo · do rascunho à publicação · no seu ritmo",
    description:
      "Gravado para quem tem uma história na cabeça e nenhuma ideia de por onde começar. Do primeiro rascunho à publicação, sem jargão e sem fórmula mágica.",
    topicsLabel: "O que você vai aprender",
    topics: [
      "Como encontrar o livro que só você pode escrever",
      "Estrutura: o esqueleto que sustenta duzentas páginas",
      "Rotina de escrita para quem tem pouco tempo",
      "Revisão: cortar sem perder a sua voz",
      "Publicação na Amazon, no Clube de Autores e em eBook próprio",
    ],
    howItWorks: {
      label: "Como funciona",
      steps: [
        {
          number: "01",
          title: "Assista à aula 1",
          // O cliente confirmou que a aula 1 é gratuita APÓS cadastro — a
          // versão anterior dizia "sem cadastro", o oposto. Cartão continua
          // fora: não há checkout nenhum ainda.
          text: "A aula 1 é gratuita, liberada depois do cadastro. Sem cartão. O vídeo será regravado antes de entrar no ar.",
        },
        {
          number: "02",
          // Inscrições ainda não abriram — nada de prometer pagamento
          // dentro do site nem envio automático de login por e-mail, já
          // que nenhum dos dois existe ainda.
          title: "Inscrições em breve",
          text: "O checkout ainda não está disponível. Assim que abrir, você vai poder garantir o seu acesso aqui mesmo.",
        },
        {
          number: "03",
          title: "Avance uma aula por vez",
          text: "A próxima aula abre quando você termina a anterior. É o que impede de pular etapa.",
        },
      ],
    },
    priceNote:
      "Os valores das duas modalidades ainda estão sendo definidos e serão divulgados aqui. O checkout também não está disponível.",
    plansLabel: "Modalidades de acesso",
    plansNote:
      // Dizia "foram confirmadas pelo cliente". "O cliente" é vocabulário de
      // projeto: para quem lê a página, o cliente é a própria pessoa, e a
      // frase vira nonsense. O sentido — as modalidades estão decididas, os
      // preços não — fica, agora dito de fora para dentro e igual ao inglês.
      "As duas modalidades já estão definidas e terão preços diferentes. Os valores e o período do acesso limitado ainda não foram definidos — nada aqui pode ser comprado hoje.",
    plans: [
      {
        name: "Acesso por tempo limitado",
        text: "Acesso ao curso completo por um período determinado. A duração ainda será definida.",
        statusLabel: "Em breve",
      },
      {
        name: "Acesso vitalício",
        text: "Acesso ao curso completo sem prazo para terminar. Ainda não está disponível para contratação.",
        statusLabel: "Em breve",
      },
    ],
    certificateLabel: "Certificado",
    certificateTitle: "O curso terá certificado de conclusão",
    certificateText:
      "Quem concluir o curso vai receber um certificado. As condições de emissão ainda estão sendo definidas e serão divulgadas antes das inscrições abrirem.",
    freeHighlight: "A aula 1 é gratuita, em breve.",
    freeDetail:
      "A primeira aula será regravada. Assim que ela estiver no ar, você assiste inteira sem pagar nada e sem cadastrar cartão — basta criar a sua conta. Se fizer sentido, você continua.",
    // Mesma razão do hero: um botão cujo rótulo é uma ação bloqueada não é
    // um botão, é um aviso. O aviso continua — logo acima, em `freeHighlight`
    // e `freeDetail`, e em `paths.note`. O botão passou a levar para algo que
    // existe: a página do curso.
    cta: { label: "Ver como o curso funciona", href: pagePath("course", "pt") },
    // Sem checkout implementado — nada de "Comprar o curso" prometendo uma
    // compra que ainda não existe.
    secondaryCta: { label: "Inscrições em breve", href: pagePath("course", "pt") },
    player: {
      badge: "Aula 1 — em breve",
      lessonNumber: "Aula 01",
      lessonTitle: "Por que o seu livro ainda não existe",
      statusLabel: "Em breve",
    },
  },

  about: {
    index: "04/",
    label: "Quem escreve",
    title: "Rodrigo Gambini",
    // Biografia real, reescrita a partir do texto do autor. Os fatos são dele.
    // Atenção: "42 anos" envelhece sozinho — vale trocar por "há mais de vinte
    // anos escrevendo" se ninguém for revisar o site todo ano.
    paragraphs: [
      "Comecei a escrever como exercício pessoal: um jeito de entender o que eu estava pensando. Mais de uma dezena de livros depois — entre suspense psicológico, drama humano, desenvolvimento pessoal e autoajuda — a intenção continua exatamente a mesma.",
      "Tenho 42 anos, sou empresário, marido, pai da Maria e do Daniel, e há pouco virei avô. Também trabalho com audiovisual, como filmmaker, editor e produtor — e é de lá que vem o meu jeito de contar história: penso em cena antes de pensar em frase.",
      "Não escrevo para dar respostas prontas. Escrevo para provocar as perguntas certas. É assim que ensino quem quer escrever o primeiro livro, e é assim que escrevo o livro de quem prefere assinar sozinho a capa.",
    ],
    cta: { label: "Conheça minha história", href: pagePath("about", "pt") },
    portrait: {
      src: "/people/rodrigo-sobre.png",
      alt: "Retrato de Rodrigo Gambini em pé, em um escritório com estante de livros, segurando uma caneta",
      width: 1792,
      height: 2390,
    },
  },

  // Sem depoimento real e autorizado ainda — nada aqui até que exista (ver
  // nota no tipo SiteContent). Não reintroduza nomes/falas fictícias.

  behind: {
    index: "05/",
    label: "O processo",
    title: "Da ideia ao livro publicado",
    lead: "É o mesmo caminho nos três casos — escrevendo sozinho, aprendendo pelo curso ou entregando a história para alguém escrever. O que muda é quem segura a caneta em cada etapa.",
    stagesLabel: "Quatro etapas",
    stages: [
      {
        number: "01",
        title: "Encontre a história",
        text: "Antes da primeira frase: o que este livro tem a dizer, e por que só você pode escrevê-lo.",
      },
      {
        number: "02",
        title: "Estruture o livro",
        text: "O esqueleto que sustenta duzentas páginas. Capítulo por capítulo, antes de escrever qualquer um deles.",
      },
      {
        number: "03",
        title: "Escreva e revise",
        text: "A rotina que cabe na sua semana e a revisão que corta sem apagar a sua voz.",
      },
      {
        number: "04",
        title: "Publique",
        text: "Capa, diagramação, ISBN, loja. A parte menos romântica do ofício — e a que separa o manuscrito do livro.",
      },
    ],
    handleLabel: "Instagram",
    handle: "@eurodrigogambini",
    socialText: "Perfil pessoal de Rodrigo Gambini. O link abre fora deste site.",
    href: "https://instagram.com/eurodrigogambini",
    cta: "Acompanhar no Instagram",
  },

  newsletter: {
    label: "Material gratuito",
    title: "Os 7 erros de quem quer escrever o primeiro livro",
    description:
      "Um guia curto, direto, sem enrolação. Chega no seu e-mail em um minuto e se lê em dez.",
    emailLabel: "Seu e-mail",
    emailPlaceholder: "voce@email.com",
    submit: "Quero receber",
    success: "Pronto. Confira sua caixa de entrada — o material está a caminho.",
    invalid: "Digite um e-mail válido para continuar.",
    legal: "Sem spam. Você sai quando quiser.",
  },

  pages: {
    common: {
      breadcrumbLabel: "Você está em",
      backToHome: "Voltar para a home",
    },

    about: {
      eyebrow: "Quem escreve",
      title: "Rodrigo Gambini",
      lead: "Sou Rodrigo Gambini, escritor brasileiro vivendo nos Estados Unidos. Publico meus livros, ensino pessoas a escreverem seu primeiro livro e escrevo para quem tem uma história para contar, mas não tem tempo de colocá-la no papel.",
      portrait: {
        src: "/people/rodrigo-sobre.png",
        alt: "Retrato de Rodrigo Gambini em pé, em um escritório com estante de livros, segurando uma caneta-tinteiro",
        width: 1792,
        height: 2390,
      },
      storyLabel: "A história",
      rolesLabel: "Onde eu atuo",
      // Cada frase abaixo é reescrita do material que o próprio cliente
      // mandou. NENHUMA data, prêmio, nome de cliente ou resultado numérico
      // entra aqui — nada disso foi confirmado, e é o tipo de invenção que
      // depois vira problema.
      roles: [
        {
          number: "001",
          title: "Escritor",
          text: "Trinta e dois títulos publicados, entre suspense psicológico, drama humano, desenvolvimento pessoal e autoajuda.",
        },
        {
          number: "002",
          title: "Consultor",
          text: "Acompanho quem está escrevendo o próprio livro, do primeiro parágrafo ao arquivo final. O texto continua sendo de quem escreve.",
        },
        {
          number: "003",
          title: "Ghostwriter",
          text: "Escrevo o livro de quem tem a história e não tem o tempo. A assinatura na capa é de quem viveu a história.",
        },
        {
          number: "004",
          title: "Audiovisual",
          text: "Filmmaker, editor e produtor. É daí que vem o meu jeito de contar história: penso em cena antes de pensar em frase.",
        },
      ],
      mission: {
        label: "A BMaxy",
        title: "Por que a BMaxy existe",
        paragraphs: [
          "A BMaxy é a empresa por trás dos livros, do curso e dos serviços de escrita. Ela existe para reunir num lugar só três coisas que eu já fazia separadas: publicar o que escrevo, ensinar quem quer escrever e escrever por quem não tem tempo.",
          "Escrever, ensinar, transformar não é frase de parede — é a ordem em que as coisas acontecem aqui. Primeiro o texto. Depois o método que faz o texto existir. Depois o que ele muda em quem escreveu.",
          "A BMAXY LLC é sediada nos Estados Unidos e atende em português e em inglês.",
        ],
      },
      booksCta: { label: "Conheça os livros", href: pagePath("books", "pt") },
      contactLabel: "Contato",
      contactNote: "Para consultoria, ghostwriting ou qualquer outra conversa, escreva direto. Respondo em português ou em inglês.",
      contactCta: "Escrever para a BMaxy",
    },

    books: {
      eyebrow: "Biblioteca",
      title: "Os livros",
      lead: "Suspense psicológico, drama humano, desenvolvimento pessoal. Seis dos 32 títulos publicados — cada um com a sua página, a sua sinopse e onde comprar.",
      detailCta: "Ver o livro",
    },

    bookDetail: {
      eyebrow: "Livro",
      titleNote: null,
      synopsisLabel: "Sobre o livro",
      pricesLabel: "Preços",
      whereToBuyLabel: "Onde comprar",
      // O site não vende: não há checkout, não há carrinho, não há entrega.
      // Dizer isso em voz alta é mais honesto do que um botão "Comprar" que
      // manda a pessoa para fora sem avisar.
      externalNotice:
        "A compra acontece fora deste site, na Amazon ou no Clube de Autores. A BMaxy não processa o pagamento nem faz o envio — quem cuida disso é a loja escolhida, com as regras e os prazos dela.",
      backToCatalog: "Voltar para os livros",
      otherBooksLabel: "Outros livros",
      metaPrefix: "Livro de Rodrigo Gambini.",
    },

    consulting: {
      eyebrow: "Serviço 002",
      title: "Consultoria",
      lead: "Você escreve o seu livro. Eu leio o que você escreveu, mostro o caminho e digo o que ainda falta.",
      paragraphs: [
        "A consultoria é para quem já decidiu escrever e trava no meio: não sabe por onde começar, escreve trinta páginas e para, ou termina um rascunho inteiro sem fazer ideia se ele presta.",
        "Eu não escrevo por você — isso é ghostwriting, e é outro serviço. Aqui o texto continua sendo seu do começo ao fim. O que eu faço é encurtar o caminho: apontar o que está funcionando, o que está sobrando e o que precisa de outra volta.",
        "O trabalho passa pelas mesmas etapas por que passa um livro meu: encontrar o livro que só você pode escrever, montar a estrutura que sustenta duzentas páginas, criar uma rotina de escrita que caiba na sua semana, revisar sem perder a sua voz e, no fim, publicar.",
      ],
      stepsLabel: "Como funciona",
      steps: [
        {
          number: "01",
          title: "Uma conversa",
          text: "A gente conversa sobre o que você quer escrever e em que ponto você está. Sem compromisso.",
        },
        {
          number: "02",
          title: "Leitura do material",
          text: "Eu leio o que já existe — nem que seja uma página — antes de propor qualquer coisa.",
        },
        {
          number: "03",
          title: "Acompanhamento",
          text: "A partir daí definimos juntos o ritmo do acompanhamento e o que faz sentido para o seu livro.",
        },
      ],
      pendingLabel: "O que ainda não está definido",
      pendingIntro: "Prefiro dizer do que inventar. Estes pontos só são fechados na conversa:",
      pendingItems: [
        "O formato do acompanhamento — encontros, mensagens, leitura por capítulo.",
        "A duração do trabalho.",
        "O valor.",
      ],
      ctaLabel: "Solicitar informações",
      ctaNote: "Escreva contando em que ponto está o seu livro. É por aí que a conversa começa.",
      portrait: {
        src: "/people/rodrigo-alt-1.png",
        alt: "Rodrigo Gambini de paletó, segurando uma caneta-tinteiro",
        width: 1654,
        height: 2480,
      },
    },

    ghostwriting: {
      eyebrow: "Serviço 003",
      title: "Ghostwriting",
      lead: "Você conta a história. Eu conduzo a escrita. Na capa aparece o seu nome, sozinho.",
      paragraphs: [
        "Muita gente tem um livro inteiro pronto na cabeça e nenhuma hora livre na semana. O ghostwriting existe para isso: a história é sua, a memória é sua, a vida é sua — o trabalho de transformar tudo isso em texto é meu.",
        "Você não precisa saber escrever. Precisa saber contar. A partir do que você me contar, eu organizo o material, defino a estrutura, escrevo os capítulos e devolvo cada um para você ler, corrigir e aprovar.",
        "Você aparece como autor do livro. Meu trabalho não é assinado — é esse o combinado do serviço, e é o que faz dele ghostwriting.",
      ],
      stepsLabel: "Como funciona",
      steps: [
        {
          number: "01",
          title: "Começa por uma conversa",
          text: "Você conta o que quer contar e eu digo, com honestidade, se aquilo vira livro.",
        },
        {
          number: "02",
          title: "Você conta, eu escrevo",
          text: "A escrita é conduzida por mim, a partir do que veio de você. Você não precisa redigir nada.",
        },
        {
          number: "03",
          title: "Você lê e aprova",
          text: "Nada segue adiante sem a sua leitura. O texto volta para as suas mãos antes de virar livro.",
        },
        {
          number: "04",
          title: "Você assina",
          text: "O livro sai com o seu nome como autor.",
        },
      ],
      pendingLabel: "O que ainda não está definido",
      pendingIntro: "Nada disso está fechado, e eu não vou chutar. Tudo é combinado caso a caso:",
      pendingItems: [
        "O prazo de entrega.",
        "O número de páginas.",
        "O valor do trabalho.",
        "Os termos do contrato, incluindo os de confidencialidade.",
      ],
      ctaLabel: "Solicitar informações",
      ctaNote: "Conte em poucas linhas qual é a história. A conversa começa aí.",
      portrait: {
        src: "/people/rodrigo-alt-2.png",
        alt: "Rodrigo Gambini de camiseta, com as mãos nos bolsos",
        width: 1654,
        height: 2480,
      },
    },

    course: {
      eyebrow: "Serviço 004",
      title: "Seu Livro",
      lead: "Aulas em vídeo para tirar o livro da cabeça e colocá-lo no mundo. Do primeiro rascunho à publicação.",
      factsLabel: "O curso em números",
      // O terceiro número era "R$ 349 / ou US$ 99". Saiu: o cliente confirmou
      // que os preços das duas modalidades ainda não foram definidos, então o
      // valor não podia continuar apresentado como fechado.
      facts: [
        { value: "2", label: "Modalidades de acesso" },
        { value: "7 dias", label: "Prazo para pedir reembolso" },
        { value: "Previsto", label: "Certificado de conclusão" },
      ],
      accessLabel: "Como o acesso funciona",
      accessSteps: [
        {
          number: "01",
          title: "Crie a sua conta",
          text: "O cadastro é gratuito e é ele que libera a aula 1. Nenhum cartão é pedido.",
        },
        {
          number: "02",
          title: "Assista à aula 1 sem pagar",
          text: "A primeira aula não é cobrada. O vídeo será regravado — assim que estiver pronto, ele aparece na sua área.",
        },
        {
          number: "03",
          title: "Avance uma aula por vez",
          text: "A aula seguinte só abre quando você conclui a anterior. É o que impede de pular etapa.",
        },
      ],
      statusLabel: "Situação hoje",
      statusTitle: "As inscrições ainda não abriram",
      statusText:
        "Não existe checkout no site: hoje não é possível comprar o curso aqui nem em nenhum outro lugar. Os preços das duas modalidades ainda estão sendo definidos, e a forma de pagamento ainda está sendo montada. Criar a conta agora não gera cobrança nenhuma.",
      signupCta: { label: "Criar conta", href: "/cadastro" },
      signupNote: "A mesma conta vai dar acesso à sua área de aluno quando o curso abrir.",
    },
  },

  footer: {
    wordmark: "BMAXY",
    columns: [
      {
        title: "Navegação",
        links: [
          { label: "Sobre", href: pagePath("about", "pt") },
          { label: "Livros", href: pagePath("books", "pt") },
          { label: "Consultoria", href: pagePath("consulting", "pt") },
          { label: "Ghostwriting", href: pagePath("ghostwriting", "pt") },
          { label: "Curso", href: pagePath("course", "pt") },
          { label: "Área do aluno", href: "/entrar" },
          { label: "Criar conta", href: "/cadastro" },
        ],
      },
      {
        title: "Redes",
        links: [
          {
            label: "Instagram",
            href: "https://instagram.com/eurodrigogambini",
            external: true,
          },
          {
            label: "TikTok",
            href: "https://tiktok.com/@eurodrigogambini",
            external: true,
          },
          { label: "X", href: "https://x.com/rogambini", external: true },
          {
            label: "Threads",
            href: "https://www.threads.net/@eurodrigogambini",
            external: true,
          },
          {
            label: "Clube de Autores (BR)",
            href: "https://clubedeautores.com.br",
            external: true,
          },
        ],
      },
    ],
    contact: {
      title: "Contato",
      email: "contact@bmaxy.com",
      lines: [
        "BMAXY LLC · Estados Unidos",
        "Atendimento em português e em inglês",
      ],
    },
    copyright: "© 2026 BMAXY LLC. Todos os direitos reservados.",
    legal: [
      { label: "Política de Privacidade", href: pagePath("privacy", "pt") },
      { label: "Termos de Uso", href: pagePath("terms", "pt") },
    ],
  },
};

/* --------------------------------- inglês --------------------------------- */

/**
 * Mesma estrutura de `pt`. Agora TODAS as páginas públicas existem também em
 * inglês (`/en/about`, `/en/books`, `/en/books/[slug]`, `/en/consulting`,
 * `/en/ghostwriting`, `/en/course`), então `nav`, `headerCta`,
 * `services.items`, `course.cta` etc. apontam para páginas de verdade — não
 * mais para âncoras da home, que era o desenho de quando só a home era
 * bilíngue.
 *
 * Exceção conhecida: a PLATAFORMA (`/entrar`, `/cadastro`) ainda é só em
 * português. Os links em inglês reusam a mesma rota — o rótulo muda, o
 * caminho não. Traduzir a plataforma é tarefa própria, ainda não feita.
 *
 * Nomes próprios NÃO são traduzidos: títulos dos livros, "BMaxy", "Clube de
 * Autores", o @ do Instagram e as URLs. O curso usa "Write Your Book" na
 * experiência em inglês para evitar texto misto.
 *
 * -----------------------------------------------------------------------------
 * ESTA VERSÃO É APRESENTADA COMERCIALMENTE PARA AMERICANOS. Ela tem que parecer
 * escrita em inglês, não traduzida. Três regras que já custaram correção:
 *
 * 1. NADA DE texto misto como "Seu Livro Course". Na experiência em inglês,
 *    o nome de exibição é "Write Your Book" e a categoria é "Book Writing
 *    Course".
 *
 * 2. "Consulting" virou "Book Coaching". Em inglês americano, "consulting"
 *    sozinho é consultoria de gestão; o serviço que existe aqui chama-se book
 *    coaching. As URLs NÃO mudam: /en/consulting continua /en/consulting.
 *
 * 3. TÍTULOS DOS LIVROS FICAM EM PORTUGUÊS. São nomes oficiais. Não invente
 *    título em inglês — isso sugeriria existir uma tradução publicada. O
 *    contexto que se pode dar é o idioma do TÍTULO ("Original title in
 *    Portuguese"), nunca o da EDIÇÃO: "Portuguese-language edition" afirma
 *    algo que não está confirmado.
 *
 * Ortografia americana em tudo (organize, not organise). Preços em real ficam
 * em real, com contexto — nada de converter para dólar numa cotação que muda.
 * -------------------------------------------------------------------------- */
const en: SiteContent = {
  meta: {
    company: "BMAXY LLC",
    domain: "bmaxy.com",
    url: "https://bmaxy.com",
    tagline: "Write, teach, transform",
    title: "BMaxy — Rodrigo Gambini | Write, teach, transform",
    titleTemplate: "%s — BMaxy",
    description:
      "Books, book coaching, ghostwriting, and the Write Your Book course, with Rodrigo Gambini. Brazilian writer based in the United States. The first lesson is free.",
    keywords: [
      "Rodrigo Gambini",
      "BMaxy",
      "how to write a book",
      "book writing course",
      "ghostwriting",
      "book coaching",
      "self-publishing",
      "Brazilian writer",
    ],
    ogAlt: "BMaxy — Rodrigo Gambini. Write, teach, transform.",
    locale: "en_US",
    authorName: "Rodrigo Gambini",
    // "audiovisual producer" é decalque do português. Em inglês americano
    // ninguém se apresenta assim — a área é "film and video".
    authorJobTitle: "Writer, book coach, ghostwriter, and film and video producer",
    authorSameAs: [
      "https://instagram.com/eurodrigogambini",
      "https://tiktok.com/@eurodrigogambini",
      "https://x.com/rogambini",
      "https://www.threads.net/@eurodrigogambini",
    ],
  },

  a11y: {
    skipToContent: "Skip to content",
    openMenu: "Open navigation menu",
    closeMenu: "Close navigation menu",
    mainNavLabel: "Main navigation",
    footerNavLabel: "Footer navigation",
    externalLinkHint: "(opens in a new tab)",
    switchToLanguage: "View this site in Portuguese",
  },

  brand: {
    wordmark: "BMAXY",
    taglineInline: "Write · Teach · Transform",
    mark: {
      src: "/brand/bmaxy-mark.svg",
      alt: "BMaxy symbol: the letter B with a gold quill writing over an open book",
      width: 96,
      height: 96,
    },
  },

  // "Consulting" sozinho, em inglês americano, é consultoria de gestão. O que
  // este serviço é chama-se BOOK COACHING no mercado americano — é o termo
  // que a pessoa certa procura. A URL continua /en/consulting: caminho não se
  // traduz depois de publicado.
  nav: [
    { label: "About", href: pagePath("about", "en") },
    { label: "Books", href: pagePath("books", "en") },
    { label: "Book Coaching", href: pagePath("consulting", "en") },
    { label: "Ghostwriting", href: pagePath("ghostwriting", "en") },
    { label: "Course", href: pagePath("course", "en") },
  ],

  // "Student area" é decalque de "área do aluno". O equivalente americano de
  // uma área de curso atrás de login é "student portal".
  studentArea: { label: "Student portal", href: "/entrar?locale=en" },
  studentAreaShort: "Log in",
  signupLink: { label: "Create account", href: "/cadastro?locale=en" },

  // Ver a nota no headerCta em português: a ação bloqueada saiu do botão mais
  // visível do site. A aula gratuita continua dita em `paths.note` e em
  // `course.freeHighlight`.
  headerCta: { label: "Explore the Course", href: pagePath("course", "en") },
  headerCtaShort: "Course",

  hero: {
    label: "Write, teach, transform",
    // "a story" é a linha mais curta das três — bem mais folgada que o pior
    // caso em português ("tem uma história"). Sem risco de overflow.
    titleLines: ["Everyone has", "a story", "to tell"],
    paragraph:
      "I'm Rodrigo Gambini, a Brazilian writer living in the United States. I publish my own books, teach people to write their first one, and write for those who have a story to tell but no time to put it on paper.",
    // Ver a nota da versão em português: a porta principal deixou de ser uma
    // ação bloqueada e passou a ser a pergunta do visitante, logo abaixo.
    primaryCta: { label: "Start Your Book", href: "#paths" },
    secondaryCta: { label: "See the books", href: pagePath("books", "en") },
    scrollHint: "Scroll",
    portrait: {
      src: "/people/rodrigo-hero.png",
      alt: "Portrait of Rodrigo Gambini sitting at a desk, writing in a notebook, with a stack of books beside him",
      width: 1023,
      height: 1537,
    },
  },

  paths: {
    anchor: "paths",
    index: "00/",
    label: "Where to start",
    title: "How Do You Want to Turn Your Story Into a Book?",
    lead: "Three ways to reach the same place. What changes is who does the writing — and how much time you have.",
    items: [
      {
        number: "01",
        title: "I Want to Write My Own Book",
        // Nada de "literary consulting" aqui: a frase precisa se explicar
        // sozinha para quem nunca contratou esse tipo de serviço.
        text: "You do the writing, in your own words and your own voice. Rodrigo reads what you already have, tells you what's working, what needs another pass, and what comes next — from the first paragraph to the file that's ready to publish.",
        cta: { label: "Explore Book Coaching", href: pagePath("consulting", "en") },
      },
      {
        number: "02",
        title: "I Want to Learn Step by Step",
        text: "Video lessons that walk through the whole path: finding the story, building the structure, writing, revising, and publishing. You watch at your own pace, as many times as you need, with nobody waiting on you.",
        cta: { label: "Explore the Course", href: pagePath("course", "en") },
      },
      {
        number: "03",
        title: "I Want My Story Written for Me",
        // Mesma regra: nada de contar com o visitante já saber o que é
        // "ghostwriting" — a palavra só aparece no botão.
        text: "You tell your story and Rodrigo turns it into a book. You never have to write a word: you read each chapter, correct it, approve it. The name on the cover is yours, alone.",
        cta: { label: "Explore Ghostwriting", href: pagePath("ghostwriting", "en") },
      },
    ],
    // A informação que saiu do CTA do hero. As duas metades andam juntas: é
    // gratuita E ainda não está no ar.
    note: "Lesson 1 of the course will be free. It's still being re-recorded — once it's live, you can watch the whole thing without paying anything and without entering a credit card.",
    noteCta: { label: "See how the course works", href: pagePath("course", "en") },
  },

  marquee: {
    items: ["Books", "Book Coaching", "Ghostwriting", "Book Writing Course"],
    separator: "·",
    pauseLabel: "Pause the scrolling banner",
    playLabel: "Resume the scrolling banner",
  },

  stats: {
    label: "By the numbers",
    // As mesmas quatro métricas verificáveis da versão em português.
    items: [
      { value: "32", label: "Published books" },
      { value: "6", label: "Featured titles" },
      { value: "3", label: "Paths to publication" },
      { value: "2", label: "Languages we work in" },
    ],
  },

  services: {
    index: "01/",
    label: "Services",
    // Era "Four paths" — ver a nota da versão em português: a seção 00/ é a
    // dos caminhos agora.
    title: "What BMaxy does",
    items: [
      {
        number: "001",
        title: "Books",
        // "Start wherever your shelf calls for" era tradução literal de
        // "comece por onde a sua estante pedir" — não é inglês.
        description: "My titles in print and eBook. Start with whichever one speaks to you.",
        href: pagePath("books", "en"),
      },
      {
        number: "002",
        title: "Book Coaching",
        description:
          "You write, I show the way. Guidance from the first paragraph to the final file.",
        href: pagePath("consulting", "en"),
      },
      {
        number: "003",
        title: "Ghostwriting",
        description:
          "You tell the story, I write the book. The name on the cover is yours, and only yours.",
        href: pagePath("ghostwriting", "en"),
      },
      {
        number: "004",
        title: "Course",
        description:
          "Video lessons to get the book out of your head and into the world. The first lesson is free.",
        href: pagePath("course", "en"),
      },
    ],
  },

  books: {
    index: "02/",
    label: "Library",
    title: "The books",
    intro:
      "Psychological suspense, human drama, personal development. Six of 32 published titles — start with whichever one speaks to you.",
    note: "Print and Kindle links open on the retailer's site (Amazon or Clube de Autores). Direct eBook sales through this site aren't available yet.",
    // Os títulos ficam em português porque são os nomes OFICIAIS das obras.
    // Isto NÃO diz "Portuguese-language edition": o idioma da edição não está
    // confirmado, só o do título. Ver o comentário no tipo.
    titleNote: "Original titles in Portuguese.",
    // Conversão informativa aprovada para a apresentação internacional.
    // `{rate}` é substituído pela cotação REAL, lida do banco em tempo de
    // renderização — ver `notaDeConversao` em src/lib/money.ts.
    //
    // O número já esteve escrito aqui à mão ("R$ 5.10 per US$ 1"). Era verdade
    // enquanto a cotação era constante; virou uma afirmação falsa no instante
    // em que ela passou a ser editável no painel, porque a página continuaria
    // jurando 5,10 ao lado de preços calculados com outro valor. Um site que
    // mostra o próprio critério errado é pior do que um que não o mostra.
    priceNote:
      "Approximate USD values converted at R$ {rate} per US$ 1. Final prices may vary by retailer and exchange rate.",
    formatsLabel: "Where to buy",
    priceLabels: { print: "Print", ebook: "eBook" },
    // Títulos NÃO traduzidos (nomes próprios/oficiais dos livros). Os valores
    // em dólar são aproximados; os preços em BRL continuam no conteúdo PT.
    // Links de Amazon e Clube de Autores são os MESMOS de `pt`.
    allBooks: { label: "See all the books", href: pagePath("books", "en") },
  },

  course: {
    index: "03/",
    label: "Course",
    title: "Write Your Book",
    // "Lifetime access" saiu daqui pelo mesmo motivo do português: nunca foi
    // confirmado. Os três dados abaixo são os confirmados.
    subtitle: "Video lessons · from first draft to publication · at your pace",
    description:
      "Recorded for anyone with a story in their head and no idea where to start. From the first draft to publication, no jargon and no magic formula.",
    topicsLabel: "What you'll learn",
    topics: [
      "How to find the book only you can write",
      "Structure: the skeleton that holds up two hundred pages",
      "A writing routine for people with little time",
      "Editing: cutting without losing your voice",
      "Publishing on Amazon, Clube de Autores, and as your own eBook",
    ],
    howItWorks: {
      label: "How it works",
      steps: [
        {
          number: "01",
          title: "Watch lesson 1",
          // Lesson 1 is free AFTER signing up — the previous copy said the
          // opposite ("no sign-up"). No card either way: there's no checkout.
          text: "Lesson 1 is free, unlocked once you create your account. No credit card required. The video is being re-recorded before it goes live.",
        },
        {
          number: "02",
          // Enrollment hasn't opened yet — no promising in-site payment or
          // automatic login delivery, since neither exists yet.
          title: "Enrollment opens soon",
          text: "Checkout isn't available yet. Once it opens, you'll be able to get access right here.",
        },
        {
          number: "03",
          title: "Move one lesson at a time",
          text: "The next lesson unlocks when you finish the previous one. That's what keeps you from skipping ahead.",
        },
      ],
    },
    priceNote:
      "Pricing for both plans is still being decided and will be posted here. Checkout isn't available yet either.",
    plansLabel: "Access plans",
    plansNote:
      "Both plans are confirmed and will be priced differently. The prices, and how long limited-term access lasts, haven't been decided yet — nothing here can be bought today.",
    // "Limited-time access" soava a promoção por tempo limitado (desconto),
    // não a um plano com prazo de acesso. "Limited-Term Access" é o termo do
    // mercado americano de cursos, e não promete desconto nenhum.
    plans: [
      {
        name: "Limited-Term Access",
        text: "Access to the full course for a set period. How long that period lasts is still to be decided.",
        statusLabel: "Coming Soon",
      },
      {
        name: "Lifetime Access",
        text: "Access to the full course with no deadline to finish. Not available to purchase yet.",
        statusLabel: "Coming Soon",
      },
    ],
    certificateLabel: "Certificate",
    certificateTitle: "The course will include a certificate of completion",
    certificateText:
      "Anyone who finishes the course will receive a certificate. The requirements for earning it are still being set and will be posted before enrollment opens.",
    freeHighlight: "Lesson 1 is free — coming soon.",
    freeDetail:
      "The first lesson is being re-recorded. As soon as it's live, you'll be able to watch the whole thing without paying anything and without entering a credit card — you just create your account. If it clicks, you keep going.",
    cta: { label: "See how the course works", href: pagePath("course", "en") },
    // No checkout implemented — no "Buy the course" promising a purchase
    // that doesn't exist.
    secondaryCta: { label: "Enrollment Coming Soon", href: pagePath("course", "en") },
    player: {
      badge: "Lesson 1 — Coming Soon",
      lessonNumber: "Lesson 01",
      lessonTitle: "Why your book doesn't exist yet",
      statusLabel: "Coming Soon",
    },
  },

  about: {
    index: "04/",
    // Era "Who writes", decalque de "quem escreve" — em inglês soa como uma
    // pergunta pela metade.
    label: "The author",
    title: "Rodrigo Gambini",
    paragraphs: [
      "I started writing as a personal exercise: a way to understand what I was thinking. More than a dozen books later — spanning psychological suspense, human drama, personal development, and self-help — the intention is still exactly the same.",
      "I'm 42, a business owner, a husband, father to Maria and Daniel, and recently became a grandfather. I also work in film, as a filmmaker, editor, and producer — and that's where my way of telling a story comes from: I think in scenes before I think in sentences.",
      "I don't write to hand out easy answers. I write to raise the right questions. That's how I teach people who want to write their first book, and it's how I write the book for someone who'd rather sign the cover alone.",
    ],
    cta: { label: "Read my story", href: pagePath("about", "en") },
    portrait: {
      src: "/people/rodrigo-sobre.png",
      alt: "Portrait of Rodrigo Gambini standing in an office with a bookshelf, holding a pen",
      width: 1792,
      height: 2390,
    },
  },

  // No real, authorized testimonial yet — nothing here until one exists
  // (see note on the SiteContent type). Do not reintroduce fictional
  // names/quotes.

  behind: {
    index: "05/",
    label: "The process",
    title: "From Idea to Published Book",
    lead: "It's the same path all three ways — writing it yourself, learning it through the course, or handing the story to someone else to write. What changes is who's holding the pen at each stage.",
    stagesLabel: "Four stages",
    stages: [
      {
        number: "01",
        title: "Find Your Story",
        text: "Before the first sentence: what this book has to say, and why you're the only one who can write it.",
      },
      {
        number: "02",
        title: "Build the Structure",
        text: "The skeleton that holds up two hundred pages. Chapter by chapter, before a single one gets written.",
      },
      {
        number: "03",
        title: "Write and Revise",
        text: "The routine that fits your week, and the editing pass that cuts without erasing your voice.",
      },
      {
        number: "04",
        title: "Publish Your Book",
        text: "Cover, layout, ISBN, storefront. The least romantic part of the craft — and the one that separates a manuscript from a book.",
      },
    ],
    handleLabel: "Instagram",
    handle: "@eurodrigogambini",
    socialText: "Rodrigo Gambini's personal profile. The link opens outside this site.",
    href: "https://instagram.com/eurodrigogambini",
    cta: "Follow on Instagram",
  },

  newsletter: {
    label: "Free resource",
    title: "The 7 mistakes people make writing their first book",
    description:
      "A short, straightforward guide, no filler. It lands in your inbox in a minute and takes ten to read.",
    emailLabel: "Your email",
    emailPlaceholder: "you@email.com",
    submit: "Send it to me",
    success: "Done. Check your inbox — the guide is on its way.",
    invalid: "Enter a valid email to continue.",
    legal: "No spam. Unsubscribe anytime.",
  },

  pages: {
    common: {
      // Era "You are in" — tradução ao pé da letra de "você está em".
      breadcrumbLabel: "You are here",
      backToHome: "Back to home",
    },

    about: {
      eyebrow: "The author",
      title: "Rodrigo Gambini",
      lead: "I'm Rodrigo Gambini, a Brazilian writer living in the United States. I publish my own books, teach people to write their first one, and write for those who have a story to tell but no time to put it on paper.",
      portrait: {
        src: "/people/rodrigo-sobre.png",
        alt: "Portrait of Rodrigo Gambini standing in an office with a bookshelf, holding a fountain pen",
        width: 1792,
        height: 2390,
      },
      storyLabel: "The story",
      rolesLabel: "What I do",
      // Every line here is rewritten from material the client sent. NO dates,
      // awards, client names, or numeric results — none of that was confirmed.
      roles: [
        {
          number: "001",
          title: "Writer",
          text: "Thirty-two published titles, spanning psychological suspense, human drama, personal development, and self-help.",
        },
        {
          number: "002",
          title: "Book Coach",
          text: "I guide people writing their own book, from the first paragraph to the final file. The text stays theirs.",
        },
        {
          number: "003",
          title: "Ghostwriter",
          text: "I write the book for people who have the story but not the time. The name on the cover belongs to whoever lived it.",
        },
        {
          number: "004",
          title: "Film",
          text: "Filmmaker, editor, and producer. That's where my way of telling a story comes from: I think in scenes before I think in sentences.",
        },
      ],
      mission: {
        label: "BMaxy",
        title: "Why BMaxy exists",
        paragraphs: [
          "BMaxy is the company behind the books, the course, and the writing services. It exists to bring together in one place three things I was already doing separately: publishing what I write, teaching people who want to write, and writing for people who don't have the time.",
          "Write, teach, transform isn't a line on a wall — it's the order things happen in here. First the text. Then the method that makes the text exist. Then what it changes in the person who wrote it.",
          "BMAXY LLC is based in the United States and works in both Portuguese and English.",
        ],
      },
      booksCta: { label: "See the books", href: pagePath("books", "en") },
      contactLabel: "Contact",
      contactNote: "For book coaching, ghostwriting, or anything else, just email me. I answer in Portuguese or English.",
      contactCta: "Email BMaxy",
    },

    books: {
      eyebrow: "Library",
      title: "The books",
      lead: "Psychological suspense, human drama, personal development. Six of 32 published titles — each with its own page, synopsis, and where to buy it.",
      detailCta: "See the book",
    },

    bookDetail: {
      eyebrow: "Book",
      // Singular de `books.titleNote`. Ver o comentário no tipo: diz o idioma
      // do TÍTULO, não o da edição — este último não está confirmado.
      titleNote: "Original title in Portuguese.",
      synopsisLabel: "About the book",
      pricesLabel: "Prices",
      whereToBuyLabel: "Where to buy",
      // The site doesn't sell: no checkout, no cart, no shipping. Saying so
      // out loud beats a "Buy" button that quietly sends people elsewhere.
      externalNotice:
        "You'll complete the purchase off this site, on Amazon or Clube de Autores. BMaxy doesn't process the payment or ship the book — the retailer you pick does, under its own terms and delivery times.",
      backToCatalog: "Back to the books",
      otherBooksLabel: "Other books",
      metaPrefix: "A book by Rodrigo Gambini.",
    },

    consulting: {
      eyebrow: "Service 002",
      title: "Book Coaching",
      lead: "You write your book. I read what you wrote, show the way, and tell you what's still missing.",
      paragraphs: [
        "Book coaching is for people who have already decided to write and get stuck partway: they don't know where to start, they write thirty pages and stop, or they finish a whole draft with no idea whether it's any good.",
        "I don't write it for you — that's ghostwriting, and it's a different service. Here the text stays yours from beginning to end. What I do is shorten the path: point out what's working, what's excess, and what needs another pass.",
        "The work goes through the same stages one of my own books goes through: finding the book only you can write, building the structure that holds up two hundred pages, creating a writing routine that fits your week, editing without losing your voice, and finally publishing.",
      ],
      stepsLabel: "How it works",
      steps: [
        {
          number: "01",
          title: "A conversation",
          text: "We talk about what you want to write and where you are right now. No commitment.",
        },
        {
          number: "02",
          title: "Reading your material",
          text: "I read what already exists — even if it's a single page — before proposing anything.",
        },
        {
          number: "03",
          title: "Ongoing guidance",
          text: "From there we set the pace of the work together, and what actually makes sense for your book.",
        },
      ],
      pendingLabel: "What isn't defined yet",
      pendingIntro: "I'd rather say so than make it up. These get settled in the conversation:",
      pendingItems: [
        "The format of the coaching — calls, messages, chapter-by-chapter reading.",
        "How long the work lasts.",
        "The price.",
      ],
      ctaLabel: "Request information",
      ctaNote: "Write and tell me where your book stands. That's where the conversation starts.",
      portrait: {
        src: "/people/rodrigo-alt-1.png",
        alt: "Rodrigo Gambini in a blazer, holding a fountain pen",
        width: 1654,
        height: 2480,
      },
    },

    ghostwriting: {
      eyebrow: "Service 003",
      title: "Ghostwriting",
      lead: "You tell the story. I do the writing. The name on the cover is yours, alone.",
      paragraphs: [
        "Plenty of people have an entire book ready in their head and not one free hour in the week. That's what ghostwriting is for: the story is yours, the memory is yours, the life is yours — the work of turning all that into text is mine.",
        // "organise" era grafia britânica. A versão EN é para leitor
        // americano — ortografia americana em tudo.
        "You don't need to know how to write. You need to know how to tell it. From what you tell me, I organize the material, define the structure, write the chapters, and hand each one back to you to read, correct, and approve.",
        "You appear as the author of the book. My work isn't credited — that's the arrangement, and it's what makes it ghostwriting.",
      ],
      stepsLabel: "How it works",
      steps: [
        {
          number: "01",
          title: "It starts with a conversation",
          text: "You tell me what you want to tell, and I say honestly whether it becomes a book.",
        },
        {
          number: "02",
          title: "You tell it, I write it",
          text: "The writing is led by me, from what came from you. You don't have to draft anything.",
        },
        {
          number: "03",
          title: "You read and approve",
          text: "Nothing moves forward without your reading. The text comes back to you before it becomes a book.",
        },
        {
          number: "04",
          title: "You sign it",
          text: "The book goes out with your name as the author.",
        },
      ],
      pendingLabel: "What isn't defined yet",
      pendingIntro: "None of this is settled, and I won't guess. It's agreed on case by case:",
      pendingItems: [
        "The delivery timeline.",
        "The page count.",
        "The price of the work.",
        "The terms of the contract, including confidentiality.",
      ],
      ctaLabel: "Request information",
      ctaNote: "Tell me in a few lines what the story is. That's where it starts.",
      portrait: {
        src: "/people/rodrigo-alt-2.png",
        alt: "Rodrigo Gambini in a t-shirt, hands in his pockets",
        width: 1654,
        height: 2480,
      },
    },

    course: {
      eyebrow: "Service 004",
      title: "Write Your Book",
      lead: "Video lessons to get the book out of your head and into the world. From the first draft to publication.",
      factsLabel: "The course in numbers",
      // The third figure used to be "R$ 349 / or US$ 99". It's gone: the
      // client confirmed pricing for both plans is still undecided, so it
      // could not stay on the page as a settled number.
      facts: [
        { value: "2", label: "Access plans" },
        { value: "7 days", label: "Refund request period" },
        { value: "Planned", label: "Certificate of completion" },
      ],
      accessLabel: "How access works",
      accessSteps: [
        {
          number: "01",
          title: "Create your account",
          text: "Signing up is free, and it's what unlocks lesson 1. No credit card required.",
        },
        {
          number: "02",
          title: "Watch lesson 1 at no cost",
          text: "The first lesson costs nothing. The video is being re-recorded — once it's ready, it shows up in your student portal.",
        },
        {
          number: "03",
          title: "Move one lesson at a time",
          text: "The next lesson only opens when you finish the previous one. That's what keeps you from skipping ahead.",
        },
      ],
      statusLabel: "Where things stand",
      statusTitle: "Enrollment hasn't opened yet",
      statusText:
        "There's no checkout on the site: right now the course can't be bought here or anywhere else. Pricing for both plans is still being decided, and the payment side is still being built. Creating an account today doesn't charge you anything.",
      signupCta: { label: "Create account", href: "/cadastro?locale=en" },
      signupNote: "The same account gets you into your student portal once the course opens.",
    },
  },

  footer: {
    wordmark: "BMAXY",
    columns: [
      {
        title: "Navigation",
        links: [
          { label: "About", href: pagePath("about", "en") },
          { label: "Books", href: pagePath("books", "en") },
          { label: "Book Coaching", href: pagePath("consulting", "en") },
          { label: "Ghostwriting", href: pagePath("ghostwriting", "en") },
          { label: "Course", href: pagePath("course", "en") },
          { label: "Student portal", href: "/entrar?locale=en" },
          { label: "Create account", href: "/cadastro?locale=en" },
        ],
      },
      {
        title: "Social",
        links: [
          {
            label: "Instagram",
            href: "https://instagram.com/eurodrigogambini",
            external: true,
          },
          {
            label: "TikTok",
            href: "https://tiktok.com/@eurodrigogambini",
            external: true,
          },
          { label: "X", href: "https://x.com/rogambini", external: true },
          {
            label: "Threads",
            href: "https://www.threads.net/@eurodrigogambini",
            external: true,
          },
          {
            label: "Clube de Autores (Brazil)",
            href: "https://clubedeautores.com.br",
            external: true,
          },
        ],
      },
    ],
    contact: {
      title: "Contact",
      email: "contact@bmaxy.com",
      lines: ["BMAXY LLC · United States", "We work in English and Portuguese"],
    },
    copyright: "© 2026 BMAXY LLC. All rights reserved.",
    legal: [
      // Apontavam para /privacidade e /termos — as versões em PORTUGUÊS.
      // Passou despercebido enquanto as duas eram placeholder idêntico em
      // qualquer idioma; virou erro real quando o texto passou a existir.
      { label: "Privacy Policy", href: pagePath("privacy", "en") },
      { label: "Terms of Use", href: pagePath("terms", "en") },
    ],
  },
};

/* ---------------------------- stubs: não existem mais --------------------- */

/*
 * `stubPages` e o componente StubPage foram removidos. As duas últimas
 * páginas que dependiam deles — /privacidade e /termos — passaram a ter texto
 * real nos dois idiomas (ver src/content/legal.ts). Nenhuma rota pública do
 * site é placeholder hoje.
 *
 * Se um dia uma rota nova precisar nascer antes do conteúdo, prefira NÃO
 * publicá-la a publicá-la vazia: um link de menu para "em breve" custa mais
 * confiança do que um item de menu ausente.
 */

/* ------------------------------- exportação ------------------------------- */

export const siteContent: Record<Locale, SiteContent> = { pt, en };

/** "/" (sem prefixo) serve este idioma; só "en" ganha o prefixo "/en". */
export const defaultLocale: Locale = "pt";

/**
 * =============================================================================
 *  FATIA DO HEADER — por que ela existe
 * =============================================================================
 *
 *  `Header` e `BrandLink` são Client Components. Tudo que um Client Component
 *  recebe por prop é SERIALIZADO no HTML de cada página (o payload do RSC).
 *  Enquanto o Header recebia o `SiteContent` inteiro, toda página carregava
 *  junto o texto completo de /consultoria, /ghostwriting, /curso, as seis
 *  sinopses... mesmo em /sobre, que não usa nada disso. Medido em
 *  desenvolvimento: /sobre saía com 148 KB de HTML, boa parte só disso.
 *
 *  Então o Header recebe só o que ele de fato renderiza. O Footer continua
 *  recebendo o `site` inteiro sem custo nenhum — ele é Server Component e
 *  nada dele é serializado.
 *
 *  Se um dia o Header precisar de mais um campo, acrescente AQUI. Não volte a
 *  passar o objeto inteiro.
 * =========================================================================== */
export type HeaderContent = {
  wordmark: string;
  taglineInline: string;
  /** Vira o nome acessível da logo, junto com o wordmark. */
  tagline: string;
  openMenu: string;
  closeMenu: string;
  mainNavLabel: string;
  switchToLanguage: string;
  nav: Link[];
  studentArea: Link;
  studentAreaShort: string;
  signupLink: Link;
  headerCta: Link;
  headerCtaShort: string;
};

export function headerContent(site: SiteContent): HeaderContent {
  return {
    wordmark: site.brand.wordmark,
    taglineInline: site.brand.taglineInline,
    tagline: site.meta.tagline,
    openMenu: site.a11y.openMenu,
    closeMenu: site.a11y.closeMenu,
    mainNavLabel: site.a11y.mainNavLabel,
    switchToLanguage: site.a11y.switchToLanguage,
    nav: site.nav,
    studentArea: site.studentArea,
    studentAreaShort: site.studentAreaShort,
    signupLink: site.signupLink,
    headerCta: site.headerCta,
    headerCtaShort: site.headerCtaShort,
  };
}

/* `findBook` foi removida junto com `books.items`. O equivalente hoje é
   `getLivro(locale, slug)` em `src/lib/dal/catalog.ts`, que consulta o banco e
   respeita a RLS — um rascunho não aparece para o visitante. */

/** Endereço `mailto:` de contato — o mesmo que já aparece no rodapé. */
export function contactMailto(site: SiteContent): string {
  return `mailto:${site.footer.contact.email}`;
}

// Reexportado para os componentes não precisarem importar de dois lugares
// diferentes só pra montar um href de livro.
export { bookPath, pagePath };
