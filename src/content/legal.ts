/**
 * =============================================================================
 *  BMAXY LLC — Termos de Uso e Política de Privacidade (conteúdo)
 * =============================================================================
 *
 *  MESMA REGRA DE src/content/site.ts: nenhuma string jurídica dentro de JSX.
 *  Todo o texto dos dois documentos, nos dois idiomas, vive aqui. As páginas
 *  (`/termos`, `/privacidade`, `/en/terms`, `/en/privacy`) só percorrem esta
 *  estrutura e a desenham.
 *
 *  EQUIVALÊNCIA PT/EN — REGRA DURA
 *  -------------------------------
 *  Os dois idiomas precisam dizer a MESMA coisa. Não existe cláusula em
 *  português que não exista em inglês, e vice-versa. Ao mexer em qualquer
 *  seção, mexa nas duas: `pt.terms[n]` e `en.terms[n]` são a mesma cláusula.
 *  Os `id` de cada seção são IDÊNTICOS nos dois idiomas de propósito — é o que
 *  faz um link do tipo `/termos#refund` continuar apontando para a cláusula
 *  certa quando a pessoa troca para `/en/terms#refund`.
 *
 *  O QUE NÃO PODE ENTRAR AQUI
 *  --------------------------
 *  Nada que o cliente não tenha confirmado. Em especial: preço, moeda, duração
 *  do plano de tempo limitado, critério de emissão do certificado, critério
 *  objetivo de "boa-fé" no reembolso, número do EIN, telefone, um segundo
 *  e-mail, nome de encarregado de dados (DPO) ou qualquer prazo em dias além
 *  dos 7 dias de reembolso. O que ainda não foi decidido é DECLARADO como não
 *  decidido, em bloco `note` — o mesmo padrão honesto de
 *  `pages.consulting.pendingItems` em site.ts.
 *
 *  Estes documentos são MINUTAS TÉCNICAS INICIAIS. Ver docs/LEGAL.md para a
 *  lista do que depende de decisão do cliente e de revisão jurídica.
 * =========================================================================== */

import type { Locale } from "@/content/site";

/* --------------------------------- tipos --------------------------------- */

/**
 * `note` é o bloco destacado: serve só para dizer, em voz alta, que um ponto
 * ainda não está definido. Não use para texto normal — ele tem peso visual
 * justamente porque é a exceção.
 */
export type LegalBlock =
  | { type: "text"; text: string }
  | { type: "note"; text: string }
  | { type: "list"; items: string[] };

export type LegalSection = {
  /** Âncora estável. O MESMO valor em pt e en — ver nota no topo. */
  id: string;
  /** "01", "02"... acompanha a ordem do array. */
  number: string;
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  meta: { title: string; description: string };
  eyebrow: string;
  title: string;
  lead: string;
  updatedLabel: string;
  /** Data por extenso, no formato do idioma. */
  updatedAt: string;
  /** A mesma data em ISO, para o atributo `dateTime` do <time>. */
  updatedAtISO: string;
  /** Rótulo do índice lateral (também é o nome acessível do <nav>). */
  summaryLabel: string;
  sections: LegalSection[];
  /** Bloco de ação no fim do documento — o único link vivo da página. */
  contactNote: string;
  contactCta: string;
};

export type LegalContent = {
  terms: LegalDocument;
  privacy: LegalDocument;
};

/* ------------------------- dados oficiais da empresa ---------------------- */

/**
 * Única fonte de verdade dos dados cadastrais. Interpolado no texto dos dois
 * documentos e dos dois idiomas para que o endereço não possa divergir entre
 * quatro páginas.
 *
 * O EIN existe, mas o NÚMERO não foi fornecido pelo cliente. Não invente um
 * campo `ein` aqui: os documentos dizem que ele é informado quando exigido.
 */
export const legalEntity = {
  name: "BMAXY LLC",
  email: "contact@bmaxy.com",
  street: "330 E Central Blvd",
  city: "Orlando",
  state: "FL",
  zip: "32801",
} as const;

const ADDRESS = `${legalEntity.street}, ${legalEntity.city}, ${legalEntity.state} ${legalEntity.zip}`;
const EMAIL = legalEntity.email;
const NAME = legalEntity.name;

const UPDATED_ISO = "2026-08-04";

/** Chave de lista estável para o React, sem índice de array. */
export function blockKey(block: LegalBlock): string {
  const source = block.type === "list" ? block.items[0] : block.text;
  return source.slice(0, 40);
}

/* ============================== PORTUGUÊS ================================= */

const termsPt: LegalDocument = {
  meta: {
    title: "Termos de Uso",
    description:
      "Termos de Uso da BMAXY LLC: conta, área do aluno, planos de acesso, certificado, pagamentos, reembolso, direitos autorais e legislação aplicável.",
  },
  eyebrow: "Jurídico",
  title: "Termos de Uso",
  lead: "As regras de uso do site bmaxy.com, da área do aluno e do curso Seu Livro. Escritas para serem lidas — e honestas sobre o que ainda não está definido.",
  updatedLabel: "Atualizado em",
  updatedAt: "4 de agosto de 2026",
  updatedAtISO: UPDATED_ISO,
  summaryLabel: "Nesta página",
  contactNote:
    "Ficou alguma dúvida sobre estes Termos? Escreva direto. É o mesmo endereço para pedido de reembolso, encerramento de conta e qualquer questão jurídica.",
  contactCta: "Escrever para a BMaxy",

  sections: [
    {
      id: "company",
      number: "01",
      heading: "Quem somos",
      blocks: [
        {
          type: "text",
          text: `Este site é operado pela ${NAME}, sociedade constituída no estado da Flórida, Estados Unidos.`,
        },
        {
          type: "list",
          items: [
            `Endereço comercial: ${ADDRESS}, Estados Unidos.`,
            `E-mail de contato: ${EMAIL}.`,
            "Site: bmaxy.com, servido em português e em inglês.",
          ],
        },
        {
          type: "text",
          text: "A empresa possui número de identificação fiscal (EIN) nos Estados Unidos. O número não está publicado nesta página e é informado quando houver exigência legal, fiscal ou contratual que o justifique.",
        },
        {
          type: "text",
          text: `Nestes Termos, "BMaxy", "nós" e "nosso" se referem à ${NAME}. "Você" é a pessoa que acessa o site, cria uma conta ou contrata algum dos serviços.`,
        },
      ],
    },
    {
      id: "acceptance",
      number: "02",
      heading: "Aceitação destes Termos",
      blocks: [
        {
          type: "text",
          text: "Ao navegar pelo site, criar uma conta ou contratar qualquer serviço da BMaxy, você declara que leu, entendeu e aceita estes Termos de Uso e a Política de Privacidade. No formulário de cadastro, esse aceite é registrado no momento em que você marca a caixa correspondente.",
        },
        {
          type: "text",
          text: "Se você não concordar com algum ponto, não crie conta e não use os serviços.",
        },
        {
          type: "text",
          text: "Para criar conta é preciso ter 18 anos ou mais. Menores de 18 anos só podem usar a área do aluno com o consentimento e sob a supervisão de um responsável legal, que responde pelo uso da conta.",
        },
      ],
    },
    {
      id: "services",
      number: "03",
      heading: "O que a BMaxy oferece",
      blocks: [
        {
          type: "text",
          text: "A BMaxy reúne quatro frentes: os livros do autor, consultoria literária, ghostwriting e o curso em vídeo Seu Livro, com área do aluno.",
        },
        {
          type: "list",
          items: [
            "Livros: a compra acontece fora deste site, nas lojas parceiras. Preço, pagamento, entrega, troca e devolução são responsabilidade da loja escolhida, segundo as regras dela.",
            "Consultoria e ghostwriting: são contratados caso a caso. Formato, prazo e valor são combinados por escrito em cada trabalho, e esse acordo prevalece sobre estes Termos, que cobrem o site e a área do aluno.",
            "Curso Seu Livro: conteúdo digital em vídeo, acessado pela área do aluno, mediante cadastro e — quando as inscrições abrirem — mediante contratação de um plano de acesso.",
          ],
        },
        {
          type: "note",
          text: "As inscrições no curso ainda não abriram. Hoje não existe checkout no site: nenhuma cobrança é feita, nenhum plano está à venda e criar uma conta não gera custo nenhum.",
        },
      ],
    },
    {
      id: "account",
      number: "04",
      heading: "Cadastro, conta e segurança",
      blocks: [
        {
          type: "text",
          text: "Para acessar a área do aluno é preciso criar uma conta com nome completo, e-mail e senha.",
        },
        {
          type: "list",
          items: [
            "As informações do cadastro devem ser verdadeiras e mantidas atualizadas.",
            "A conta é pessoal e intransferível. Compartilhar login e senha com outra pessoa é descumprimento destes Termos.",
            "Você é responsável por manter a senha em sigilo e por tudo o que for feito com a sua conta.",
            `Se suspeitar de uso não autorizado, avise imediatamente pelo e-mail ${EMAIL}.`,
          ],
        },
        {
          type: "text",
          text: "A BMaxy pode recusar, suspender ou encerrar um cadastro feito com informações falsas, duplicado ou usado para burlar as regras destes Termos.",
        },
      ],
    },
    {
      id: "student-area",
      number: "05",
      heading: "Área do aluno e acesso às aulas",
      blocks: [
        {
          type: "text",
          text: "O curso é entregue em vídeo, dentro da área do aluno. As aulas são liberadas em sequência: a próxima abre quando a anterior é concluída. O vídeo de uma aula ainda bloqueada não é entregue ao seu navegador.",
        },
        {
          type: "text",
          text: "A primeira aula é gratuita e é liberada depois do cadastro, sem cartão.",
        },
        {
          type: "text",
          text: "O curso está em produção: parte das aulas ainda será gravada e publicada. A ordem, os títulos e o conteúdo das aulas podem mudar até a publicação.",
        },
        {
          type: "text",
          text: "Fazemos o possível para manter o serviço no ar, mas não prometemos funcionamento ininterrupto: pode haver manutenção, atualização e falha de serviços de terceiros dos quais a área do aluno depende.",
        },
      ],
    },
    {
      id: "plans",
      number: "06",
      heading: "Planos de acesso",
      blocks: [
        {
          type: "text",
          text: "Quando as inscrições abrirem, o curso será oferecido em dois planos: um com acesso por tempo limitado e outro com acesso vitalício, com preços diferentes.",
        },
        {
          type: "note",
          text: "Os preços, a moeda de cobrança, a duração exata do plano de tempo limitado e o alcance do plano vitalício ainda não estão definidos. Serão publicados nesta página e na página do curso antes da abertura das inscrições. Nada nesta cláusula é oferta, promessa de preço ou garantia de que um plano estará disponível.",
        },
        {
          type: "text",
          text: "O acesso vitalício ainda não é um produto disponível. Hoje nenhum dos dois planos pode ser contratado.",
        },
      ],
    },
    {
      id: "certificate",
      number: "07",
      heading: "Certificado de conclusão",
      blocks: [
        {
          type: "text",
          text: "O curso Seu Livro terá certificado de conclusão.",
        },
        {
          type: "note",
          text: "Os critérios de emissão — o que exatamente conta como concluir o curso — ainda não foram definidos. Eles serão publicados nesta página antes de o primeiro certificado ser emitido.",
        },
        {
          type: "text",
          text: `O certificado é um documento particular emitido pela ${NAME}. Ele não é diploma, não tem reconhecimento acadêmico e não confere título ou habilitação profissional.`,
        },
      ],
    },
    {
      id: "payments",
      number: "08",
      heading: "Pagamentos",
      blocks: [
        {
          type: "text",
          text: "Hoje o site não processa nenhum pagamento. Não há checkout, carrinho nem cobrança recorrente. Tudo o que esta cláusula descreve passa a valer a partir do momento em que as inscrições abrirem.",
        },
        {
          type: "list",
          items: [
            "Pagamentos com cartão serão processados pela Stripe. Os dados do cartão são informados diretamente à Stripe; a BMaxy não os armazena nem tem acesso ao número completo do cartão.",
            `PIX poderá ser oferecido a clientes no Brasil, se a conta da ${NAME} na Stripe for elegível para esse meio de pagamento. Essa elegibilidade ainda não foi confirmada.`,
            "Zelle e transferência bancária, se vierem a ser aceitos, serão alternativas separadas, combinadas por e-mail e processadas fora da Stripe. Zelle não é um meio de pagamento da Stripe.",
          ],
        },
        {
          type: "text",
          text: "O uso da Stripe está sujeito aos termos e à política de privacidade da própria Stripe. Tarifas de conversão de moeda ou de operação internacional cobradas pelo seu banco ou pelo emissor do cartão não são definidas pela BMaxy.",
        },
      ],
    },
    {
      id: "refund",
      number: "09",
      heading: "Reembolso",
      blocks: [
        {
          type: "text",
          text: `Você pode pedir reembolso do curso em até 7 (sete) dias contados da confirmação do pagamento, escrevendo para ${EMAIL}. O pedido está sujeito à comprovação de boa-fé no uso do conteúdo.`,
        },
        {
          type: "note",
          text: "Esta é uma redação provisória. O critério objetivo do que caracteriza boa-fé ainda não foi definido e será publicado nesta página antes do início das vendas. Enquanto não houver venda ativa, nenhum reembolso é devido, porque nenhum pagamento é processado.",
        },
        {
          type: "list",
          items: [
            "O pedido deve partir do e-mail cadastrado na conta.",
            "Aprovado o reembolso, a devolução é feita pelo mesmo meio de pagamento usado na compra.",
            "O prazo de crédito depende do meio de pagamento e da instituição financeira, e não é definido pela BMaxy.",
            "Com o reembolso, o acesso ao conteúdo pago é encerrado.",
          ],
        },
        {
          type: "text",
          text: "Se a lei do seu país de residência garantir direito de arrependimento ou de reembolso mais amplo do que o descrito aqui, esse direito prevalece.",
        },
      ],
    },
    {
      id: "copyright",
      number: "10",
      heading: "Direitos autorais e uso do conteúdo",
      blocks: [
        {
          type: "text",
          text: `Todo o conteúdo do site e da área do aluno — aulas em vídeo, textos, materiais de apoio, imagens, o nome e a identidade visual BMaxy — é protegido por direitos autorais e de propriedade intelectual e pertence à ${NAME} ou ao autor, conforme o caso.`,
        },
        {
          type: "text",
          text: "Ao contratar um plano de acesso, você recebe uma licença pessoal, intransferível, não exclusiva e revogável para assistir ao conteúdo, para uso próprio e não comercial. A licença não transfere a propriedade de nada.",
        },
        {
          type: "text",
          text: "Sem autorização por escrito, não é permitido:",
        },
        {
          type: "list",
          items: [
            "gravar, baixar, copiar ou reproduzir as aulas por qualquer meio;",
            "compartilhar, revender, ceder ou publicar o conteúdo, no todo ou em parte;",
            "exibir as aulas em turma, treinamento, grupo ou qualquer ambiente coletivo;",
            "compartilhar o acesso da sua conta com outra pessoa.",
          ],
        },
        {
          type: "text",
          text: "Os livros publicados pelo autor têm os seus próprios direitos, e nada nestes Termos concede licença sobre eles.",
        },
      ],
    },
    {
      id: "acceptable-use",
      number: "11",
      heading: "Uso aceitável",
      blocks: [
        {
          type: "text",
          text: "Ao usar o site e a área do aluno, você concorda em não:",
        },
        {
          type: "list",
          items: [
            "usar o serviço para finalidade ilegal ou que viole direitos de terceiros;",
            "tentar burlar o controle de acesso, a liberação sequencial das aulas ou qualquer medida de segurança;",
            "acessar áreas, contas ou dados que não sejam seus;",
            "extrair conteúdo de forma automatizada (robôs, raspagem, cópia em massa);",
            "sobrecarregar, interferir ou tentar comprometer a infraestrutura do site;",
            "se passar por outra pessoa ou pela própria BMaxy.",
          ],
        },
      ],
    },
    {
      id: "termination",
      number: "12",
      heading: "Suspensão e encerramento do acesso",
      blocks: [
        {
          type: "text",
          text: "A BMaxy pode suspender ou encerrar o acesso de uma conta que descumpra estes Termos — em especial nos casos de compartilhamento de acesso, cópia ou redistribuição do conteúdo, fraude no pagamento ou tentativa de burlar o controle das aulas.",
        },
        {
          type: "text",
          text: "Sempre que possível, avisamos antes por e-mail e damos oportunidade de corrigir o que houver.",
        },
        {
          type: "note",
          text: "O efeito de uma suspensão por descumprimento sobre valores já pagos ainda não está definido. Até que esta cláusula seja fechada, cada caso é tratado por e-mail, junto com a cláusula de reembolso — que também é provisória.",
        },
        {
          type: "text",
          text: `Você pode encerrar a sua conta quando quiser, escrevendo para ${EMAIL}.`,
        },
      ],
    },
    {
      id: "third-parties",
      number: "13",
      heading: "Serviços de terceiros",
      blocks: [
        {
          type: "text",
          text: "Para funcionar, o site e a área do aluno usam serviços operados por terceiros:",
        },
        {
          type: "list",
          items: [
            "Supabase — autenticação, banco de dados e sessão de login.",
            "YouTube (Google) — hospedagem e reprodução dos vídeos das aulas, exibidos dentro da área do aluno pelo player incorporado do YouTube.",
            "Stripe — processamento de pagamentos com cartão, quando as inscrições abrirem.",
            "Provedor de hospedagem — infraestrutura de aplicação e entrega do site.",
          ],
        },
        {
          type: "text",
          text: "O uso desses serviços está sujeito aos termos e às políticas de cada um deles. A BMaxy não responde por indisponibilidade, mudança de regras ou falha desses serviços. A forma como eles tratam dados pessoais está descrita na Política de Privacidade.",
        },
      ],
    },
    {
      id: "liability",
      number: "14",
      heading: "Disponibilidade e limitação de responsabilidade",
      blocks: [
        {
          type: "text",
          text: "O curso é material educacional. Ele ensina um método de trabalho e mostra caminhos de publicação, mas não garante que você vá terminar um livro, publicá-lo, vendê-lo, ser aceito por uma editora ou obter qualquer resultado financeiro. O resultado depende do seu trabalho e de fatores fora do nosso controle.",
        },
        {
          type: "text",
          text: "Nada no site é aconselhamento jurídico, contábil, tributário ou de investimento.",
        },
        {
          type: "text",
          text: "Na máxima extensão permitida pela lei aplicável, o site e o conteúdo são fornecidos no estado em que se encontram, e a responsabilidade da BMaxy por qualquer reclamação relacionada ao curso fica limitada ao valor que você efetivamente pagou pelo acesso. Esta limitação não afasta direitos garantidos pela lei do seu país que não possam ser afastados por contrato.",
        },
      ],
    },
    {
      id: "privacy",
      number: "15",
      heading: "Privacidade e comunicações",
      blocks: [
        {
          type: "text",
          text: "O tratamento dos seus dados pessoais está descrito na Política de Privacidade, que faz parte destes Termos.",
        },
        {
          type: "text",
          text: "Usamos o e-mail cadastrado para mensagens operacionais: confirmação de cadastro, recuperação de senha, avisos sobre o curso e sobre mudanças relevantes nestes documentos. Mensagens promocionais só são enviadas com o seu consentimento, e sempre com opção de sair.",
        },
      ],
    },
    {
      id: "changes",
      number: "16",
      heading: "Alterações destes Termos e do serviço",
      blocks: [
        {
          type: "text",
          text: "Estes Termos podem ser atualizados. A data da última atualização fica sempre no topo desta página.",
        },
        {
          type: "text",
          text: "Quando a mudança for relevante — em especial nas regras de acesso, de pagamento ou de reembolso — avisamos por e-mail ou por aviso visível no site antes de ela passar a valer. Continuar usando o serviço depois disso significa aceitar a nova versão.",
        },
        {
          type: "text",
          text: "A BMaxy também pode alterar, acrescentar ou retirar partes do site e do curso. Se uma mudança reduzir de forma relevante aquilo que você contratou, avisamos por e-mail.",
        },
      ],
    },
    {
      id: "law",
      number: "17",
      heading: "Lei aplicável e foro",
      blocks: [
        {
          type: "text",
          text: "Estes Termos são regidos pelas leis do estado da Flórida, Estados Unidos, sem consideração às regras de conflito de leis.",
        },
        {
          type: "text",
          text: "Fica eleito o foro dos tribunais competentes localizados no estado da Flórida para qualquer questão decorrente destes Termos.",
        },
        {
          type: "text",
          text: "Se você for consumidor e a lei do seu país de residência garantir direitos ou foro que não possam ser afastados por contrato, esses direitos continuam valendo.",
        },
      ],
    },
    {
      id: "contact",
      number: "18",
      heading: "Contato",
      blocks: [
        {
          type: "text",
          text: "Dúvidas sobre estes Termos, pedidos de reembolso e encerramento de conta são tratados pelo mesmo endereço:",
        },
        {
          type: "list",
          items: [NAME, `${ADDRESS} — Estados Unidos`, EMAIL],
        },
      ],
    },
  ],
};

const privacyPt: LegalDocument = {
  meta: {
    title: "Política de Privacidade",
    description:
      "Como a BMAXY LLC trata os seus dados: o que é coletado, cookies estritamente essenciais, com quem compartilhamos, por quanto tempo guardamos e como exercer os seus direitos.",
  },
  eyebrow: "Jurídico",
  title: "Política de Privacidade",
  lead: "O que a BMaxy coleta, por que coleta, com quem compartilha e o que você pode pedir a qualquer momento. Sem rastreador, sem publicidade, sem venda de dados.",
  updatedLabel: "Atualizado em",
  updatedAt: "4 de agosto de 2026",
  updatedAtISO: UPDATED_ISO,
  summaryLabel: "Nesta página",
  contactNote:
    "Para acessar, corrigir ou excluir os seus dados — ou para qualquer pergunta sobre esta política — escreva direto. Todo pedido sobre dados pessoais passa por este endereço.",
  contactCta: "Escrever para a BMaxy",

  sections: [
    {
      id: "controller",
      number: "01",
      heading: "Quem é responsável pelos seus dados",
      blocks: [
        {
          type: "text",
          text: `Os dados pessoais tratados neste site são de responsabilidade da ${NAME}, sociedade constituída no estado da Flórida, Estados Unidos.`,
        },
        {
          type: "list",
          items: [
            `Endereço comercial: ${ADDRESS}, Estados Unidos.`,
            `E-mail para assuntos de privacidade: ${EMAIL}.`,
          ],
        },
        {
          type: "text",
          text: "A BMaxy não tem hoje um encarregado de proteção de dados nomeado. Todo pedido, dúvida ou reclamação sobre dados pessoais deve ser enviado para o e-mail acima, que é o canal oficial.",
        },
      ],
    },
    {
      id: "scope",
      number: "02",
      heading: "O que esta política cobre",
      blocks: [
        {
          type: "text",
          text: "Esta política vale para o site bmaxy.com — nas versões em português e em inglês — e para a área do aluno do curso Seu Livro.",
        },
        {
          type: "text",
          text: "Ela não cobre sites de terceiros que você alcança a partir daqui, como as lojas onde os livros são vendidos e os perfis em redes sociais. Cada um deles tem a própria política, e é ela que vale lá.",
        },
      ],
    },
    {
      id: "data-collected",
      number: "03",
      heading: "Quais dados coletamos",
      blocks: [
        {
          type: "text",
          text: "Coletamos só o necessário para o site e a área do aluno funcionarem:",
        },
        {
          type: "list",
          items: [
            "Dados de cadastro: nome completo, e-mail e senha. A senha é armazenada de forma criptografada pelo Supabase — a BMaxy não vê nem consegue recuperar a sua senha.",
            "Preferência de idioma da sua conta (português ou inglês).",
            "Dados de uso do curso: sua matrícula, quais aulas foram concluídas, a data da conclusão e o progresso registrado pelo player enquanto o vídeo roda.",
            "Registros técnicos gerados automaticamente pelos provedores de infraestrutura — como endereço IP, data e hora do acesso e tipo de navegador —, usados para operar e proteger o serviço.",
            "O conteúdo das mensagens que você nos envia por e-mail, junto com o endereço de onde elas partiram.",
          ],
        },
        {
          type: "text",
          text: "Não pedimos documento de identidade, não coletamos dados sensíveis e não montamos perfil comportamental. Nenhuma decisão automatizada com efeito jurídico é tomada sobre você — a liberação sequencial das aulas é apenas uma regra de curso, não uma avaliação da sua pessoa.",
        },
        {
          type: "note",
          text: "Dados de pagamento: hoje nenhum. O site não processa cobrança. Quando o pagamento por cartão entrar no ar, ele será processado pela Stripe — os dados do cartão são informados diretamente a ela, e a BMaxy não armazena número de cartão, código de segurança nem dados bancários.",
        },
      ],
    },
    {
      id: "purposes",
      number: "04",
      heading: "Para que usamos esses dados",
      blocks: [
        {
          type: "list",
          items: [
            "Criar e manter a sua conta e permitir que você entre nela.",
            "Dar acesso ao curso e controlar a liberação das aulas na ordem correta.",
            "Registrar a conclusão das aulas e, quando os critérios existirem, emitir o certificado de conclusão.",
            "Responder às mensagens que você envia.",
            "Manter a segurança do serviço, prevenir fraude e apurar uso indevido.",
            "Cumprir obrigações legais, fiscais e contábeis aplicáveis à empresa.",
          ],
        },
        {
          type: "text",
          text: "Não usamos os seus dados para publicidade dirigida e não os vendemos, alugamos ou cedemos a terceiros para fins comerciais.",
        },
      ],
    },
    {
      id: "cookies",
      number: "05",
      heading: "Cookies",
      blocks: [
        {
          type: "text",
          text: "O site usa apenas cookies estritamente essenciais: os cookies de sessão criados pelo Supabase quando você entra na sua conta. Sem eles não é possível manter o login entre uma página e outra.",
        },
        {
          type: "text",
          text: "Não usamos cookies de análise de audiência, de publicidade ou de rastreamento, e não há ferramenta de estatística instalada no site. É por isso que você não vê um banner de consentimento: não há nada a consentir além do que é indispensável para o serviço funcionar.",
        },
        {
          type: "text",
          text: "Há uma exceção que vem de fora: quando você assiste a uma aula, o player do YouTube é carregado a partir dos servidores do YouTube. Nesse momento o Google pode gravar cookies e coletar dados no seu navegador, segundo as políticas dele — isso acontece dentro da área do aluno, não nas páginas públicas do site.",
        },
        {
          type: "text",
          text: "Você pode bloquear ou apagar cookies nas configurações do seu navegador. Bloqueando os de sessão, o login deixa de funcionar.",
        },
      ],
    },
    {
      id: "sharing",
      number: "06",
      heading: "Com quem compartilhamos",
      blocks: [
        {
          type: "text",
          text: "Não vendemos dados pessoais. Compartilhamos apenas o necessário, e apenas com quem opera partes do serviço:",
        },
        {
          type: "list",
          items: [
            "Supabase — autenticação, banco de dados e sessão. É onde ficam guardados o seu cadastro e o seu progresso no curso.",
            "YouTube (Google) — hospedagem e reprodução dos vídeos das aulas.",
            "Provedor de hospedagem — infraestrutura de aplicação e entrega do site, que gera os registros técnicos de acesso.",
            "Stripe — processamento de pagamentos com cartão, quando as inscrições abrirem.",
            "Autoridades públicas, quando houver obrigação legal ou ordem judicial.",
          ],
        },
        {
          type: "text",
          text: "Cada um desses serviços trata dados segundo a própria política de privacidade. Se quiser a lista atualizada dos provedores em uso, peça por e-mail.",
        },
      ],
    },
    {
      id: "international",
      number: "07",
      heading: "Transferência internacional",
      blocks: [
        {
          type: "text",
          text: `A ${NAME} está sediada nos Estados Unidos, e os provedores citados acima podem tratar dados em servidores localizados fora do seu país.`,
        },
        {
          type: "text",
          text: "Ao criar uma conta e usar o serviço, você entende que os seus dados podem ser transferidos, armazenados e tratados nos Estados Unidos e em outros países onde esses provedores operam.",
        },
      ],
    },
    {
      id: "retention",
      number: "08",
      heading: "Por quanto tempo guardamos",
      blocks: [
        {
          type: "text",
          text: "Os dados de cadastro e de progresso ficam guardados enquanto a sua conta existir. Se você pedir a exclusão da conta, apagamos o que não precisamos manter.",
        },
        {
          type: "text",
          text: "Depois do encerramento, mantemos apenas o que for necessário para cumprir obrigação legal, fiscal ou contábil e para defesa em eventual disputa. Registros técnicos gerados pelos provedores seguem o prazo de retenção de cada um deles.",
        },
        {
          type: "note",
          text: "Não publicamos aqui um prazo fixo em dias: ele depende da obrigação legal aplicável a cada tipo de registro e ainda está sendo definido. Se quiser saber o prazo que vale para o seu caso, peça por e-mail.",
        },
      ],
    },
    {
      id: "security",
      number: "09",
      heading: "Como protegemos os seus dados",
      blocks: [
        {
          type: "list",
          items: [
            "As senhas são armazenadas de forma criptografada pelo Supabase; ninguém na BMaxy tem acesso a elas.",
            "O acesso ao banco de dados é restrito por regras de segurança em nível de linha, que valem no próprio banco e não dependem apenas do código do site.",
            "O vídeo de uma aula bloqueada não é entregue ao navegador: o endereço do vídeo só sai do servidor para quem já liberou aquela aula.",
            "O tráfego entre o seu navegador e o site é criptografado (HTTPS).",
          ],
        },
        {
          type: "text",
          text: "Ainda assim, nenhum sistema é totalmente imune. Se acontecer um incidente de segurança que possa afetar você, avisamos pelo e-mail cadastrado e tomamos as providências cabíveis.",
        },
      ],
    },
    {
      id: "your-rights",
      number: "10",
      heading: "Seus direitos e como exercê-los",
      blocks: [
        {
          type: "text",
          text: "Dependendo de onde você mora, a legislação local — como a LGPD no Brasil, o GDPR na Europa ou leis estaduais dos Estados Unidos — pode lhe garantir direitos sobre os seus dados. Independentemente de qual lei se aplique a você, a BMaxy oferece a todas as pessoas usuárias o direito de:",
        },
        {
          type: "list",
          items: [
            "saber quais dados seus estão guardados e obter uma cópia deles;",
            "corrigir dados incompletos, desatualizados ou errados;",
            "pedir a exclusão da conta e dos dados que não precisamos manter por obrigação legal;",
            "retirar um consentimento que você tenha dado, sem afetar o que foi feito antes;",
            "se opor a um uso específico dos seus dados ou pedir que ele seja limitado;",
            "reclamar à autoridade de proteção de dados do seu país.",
          ],
        },
        {
          type: "text",
          text: `Para exercer qualquer um deles, escreva para ${EMAIL} a partir do e-mail cadastrado na conta. Podemos pedir informações adicionais para confirmar a sua identidade antes de atender — é uma proteção contra pedidos feitos por terceiros. Respondemos o quanto antes e, quando a lei do seu país fixar um prazo, dentro dele.`,
        },
      ],
    },
    {
      id: "children",
      number: "11",
      heading: "Crianças e adolescentes",
      blocks: [
        {
          type: "text",
          text: "O site e a área do aluno não são direcionados a crianças. A criação de conta exige 18 anos ou mais, ou o consentimento e a supervisão de um responsável legal.",
        },
        {
          type: "text",
          text: "Se identificarmos uma conta criada por criança sem o consentimento do responsável, excluímos os dados. Se você é responsável e acredita que isso aconteceu, escreva para o e-mail de contato.",
        },
      ],
    },
    {
      id: "email",
      number: "12",
      heading: "E-mails que você recebe",
      blocks: [
        {
          type: "text",
          text: "Hoje enviamos apenas mensagens operacionais: confirmação de cadastro, recuperação de senha, avisos sobre o curso e sobre mudanças relevantes nos documentos jurídicos. Não há lista de e-mail marketing em operação.",
        },
        {
          type: "text",
          text: "Se passarmos a enviar conteúdo promocional, será apenas para quem tiver consentido, e toda mensagem trará uma forma clara de sair da lista. Mensagens operacionais ligadas à sua conta continuam sendo enviadas enquanto a conta existir.",
        },
      ],
    },
    {
      id: "changes",
      number: "13",
      heading: "Alterações desta política",
      blocks: [
        {
          type: "text",
          text: "Esta política pode ser atualizada — por exemplo, quando um novo provedor entrar em uso ou quando o pagamento pela Stripe for ativado. A data da última atualização fica sempre no topo desta página.",
        },
        {
          type: "text",
          text: "Quando a mudança for relevante para você, avisamos pelo e-mail cadastrado ou por aviso visível no site antes de ela passar a valer.",
        },
      ],
    },
    {
      id: "contact",
      number: "14",
      heading: "Contato",
      blocks: [
        {
          type: "text",
          text: "Pedidos sobre dados pessoais e dúvidas sobre esta política são tratados por:",
        },
        {
          type: "list",
          items: [NAME, `${ADDRESS} — Estados Unidos`, EMAIL],
        },
      ],
    },
  ],
};

/* ================================ ENGLISH ================================= */

const termsEn: LegalDocument = {
  meta: {
    title: "Terms of Use",
    description:
      "BMAXY LLC Terms of Use: accounts, the student area, access plans, the certificate, payments, refunds, copyright, and governing law.",
  },
  eyebrow: "Legal",
  title: "Terms of Use",
  lead: "The rules for using bmaxy.com, the student area, and the Write Your Book course. Written to be read — and honest about what hasn't been decided yet.",
  updatedLabel: "Last updated",
  updatedAt: "August 4, 2026",
  updatedAtISO: UPDATED_ISO,
  summaryLabel: "On this page",
  contactNote:
    "Questions about these Terms? Write to us directly. It's the same address for refund requests, account closure, and any legal matter.",
  contactCta: "Email BMaxy",

  sections: [
    {
      id: "company",
      number: "01",
      heading: "Who we are",
      blocks: [
        {
          type: "text",
          text: `This site is operated by ${NAME}, a company formed in the state of Florida, United States.`,
        },
        {
          type: "list",
          items: [
            `Business address: ${ADDRESS}, United States.`,
            `Contact email: ${EMAIL}.`,
            "Website: bmaxy.com, served in Portuguese and English.",
          ],
        },
        {
          type: "text",
          text: "The company holds a U.S. Employer Identification Number (EIN). The number is not published on this page and is provided whenever a legal, tax, or contractual requirement calls for it.",
        },
        {
          type: "text",
          text: `In these Terms, "BMaxy", "we", and "our" mean ${NAME}. "You" means the person browsing the site, creating an account, or hiring any of the services.`,
        },
      ],
    },
    {
      id: "acceptance",
      number: "02",
      heading: "Accepting these Terms",
      blocks: [
        {
          type: "text",
          text: "By browsing the site, creating an account, or hiring any BMaxy service, you confirm that you have read, understood, and accepted these Terms of Use and the Privacy Policy. On the signup form, that acceptance is recorded when you tick the corresponding box.",
        },
        {
          type: "text",
          text: "If you disagree with any part of them, please don't create an account and don't use the services.",
        },
        {
          type: "text",
          text: "You must be 18 or older to create an account. People under 18 may only use the student area with the consent and supervision of a legal guardian, who is responsible for how the account is used.",
        },
      ],
    },
    {
      id: "services",
      number: "03",
      heading: "What BMaxy offers",
      blocks: [
        {
          type: "text",
          text: "BMaxy brings together four things: the author's books, literary consulting, ghostwriting, and the Write Your Book video course, with its student area.",
        },
        {
          type: "list",
          items: [
            "Books: purchases happen outside this site, at the partner stores. Price, payment, delivery, exchanges, and returns are the responsibility of the store you choose, under its own rules.",
            "Consulting and ghostwriting: hired case by case. Scope, timeline, and price are agreed in writing for each project, and that agreement prevails over these Terms, which cover the site and the student area.",
            "Write Your Book course: digital video content, accessed through the student area, after signing up and — once enrollment opens — after purchasing an access plan.",
          ],
        },
        {
          type: "note",
          text: "Course enrollment hasn't opened yet. There is no checkout on the site today: nothing is charged, no plan is on sale, and creating an account costs nothing.",
        },
      ],
    },
    {
      id: "account",
      number: "04",
      heading: "Signing up, your account, and security",
      blocks: [
        {
          type: "text",
          text: "To reach the student area you need an account, created with your full name, email address, and a password.",
        },
        {
          type: "list",
          items: [
            "The information you provide must be true and kept up to date.",
            "The account is personal and non-transferable. Sharing your login and password with someone else breaches these Terms.",
            "You are responsible for keeping your password confidential and for everything done through your account.",
            `If you suspect unauthorized use, tell us right away at ${EMAIL}.`,
          ],
        },
        {
          type: "text",
          text: "BMaxy may refuse, suspend, or close an account created with false information, duplicated, or used to work around the rules in these Terms.",
        },
      ],
    },
    {
      id: "student-area",
      number: "05",
      heading: "The student area and access to lessons",
      blocks: [
        {
          type: "text",
          text: "The course is delivered as video, inside the student area. Lessons unlock in sequence: the next one opens once you finish the previous one. The video for a locked lesson is never sent to your browser.",
        },
        {
          type: "text",
          text: "The first lesson is free and unlocks after you sign up. No card required.",
        },
        {
          type: "text",
          text: "The course is still in production: some lessons have yet to be recorded and published. The order, titles, and content of the lessons may change until they go live.",
        },
        {
          type: "text",
          text: "We do our best to keep the service running, but we don't promise uninterrupted availability: there can be maintenance, updates, and outages in third-party services the student area depends on.",
        },
      ],
    },
    {
      id: "plans",
      number: "06",
      heading: "Access plans",
      blocks: [
        {
          type: "text",
          text: "When enrollment opens, the course will be offered under two plans: one with time-limited access and one with lifetime access, at different prices.",
        },
        {
          type: "note",
          text: "Prices, billing currency, the exact length of the time-limited plan, and the scope of the lifetime plan have not been defined yet. They will be published on this page and on the course page before enrollment opens. Nothing in this clause is an offer, a price promise, or a guarantee that a given plan will be available.",
        },
        {
          type: "text",
          text: "Lifetime access is not an available product yet. Neither plan can be purchased today.",
        },
      ],
    },
    {
      id: "certificate",
      number: "07",
      heading: "Certificate of completion",
      blocks: [
        {
          type: "text",
          text: "The Write Your Book course will include a certificate of completion.",
        },
        {
          type: "note",
          text: "The criteria for issuing it — what exactly counts as completing the course — have not been defined yet. They will be published on this page before the first certificate is issued.",
        },
        {
          type: "text",
          text: `The certificate is a private document issued by ${NAME}. It is not a diploma, carries no academic accreditation, and grants no professional title or license.`,
        },
      ],
    },
    {
      id: "payments",
      number: "08",
      heading: "Payments",
      blocks: [
        {
          type: "text",
          text: "The site processes no payments today. There is no checkout, no cart, and no recurring billing. Everything in this clause applies from the moment enrollment opens.",
        },
        {
          type: "list",
          items: [
            "Card payments will be processed by Stripe. Card details go directly to Stripe; BMaxy neither stores them nor sees the full card number.",
            `PIX may be offered to customers in Brazil if the ${NAME} Stripe account is eligible for that payment method. That eligibility has not been confirmed yet.`,
            "Zelle and bank transfer, if we come to accept them, will be separate alternatives, arranged by email and handled outside Stripe. Zelle is not a Stripe payment method.",
          ],
        },
        {
          type: "text",
          text: "Using Stripe is subject to Stripe's own terms and privacy policy. Currency conversion or international transaction fees charged by your bank or card issuer are not set by BMaxy.",
        },
      ],
    },
    {
      id: "refund",
      number: "09",
      heading: "Refunds",
      blocks: [
        {
          type: "text",
          text: `You may request a refund of the course within 7 (seven) days of payment confirmation, by writing to ${EMAIL}. The request is subject to evidence of good-faith use of the content.`,
        },
        {
          type: "note",
          text: "This wording is provisional. The objective criteria for what counts as good faith have not been defined yet and will be published on this page before sales begin. While nothing is on sale, no refund is owed, because no payment is processed.",
        },
        {
          type: "list",
          items: [
            "The request must come from the email address registered on the account.",
            "Once a refund is approved, the money goes back through the same payment method used for the purchase.",
            "How long the credit takes depends on the payment method and the financial institution, and is not set by BMaxy.",
            "When a refund is issued, access to the paid content ends.",
          ],
        },
        {
          type: "text",
          text: "If the law where you live grants a broader right of withdrawal or refund than what is described here, that right prevails.",
        },
      ],
    },
    {
      id: "copyright",
      number: "10",
      heading: "Copyright and use of the content",
      blocks: [
        {
          type: "text",
          text: `Everything on the site and in the student area — video lessons, texts, supporting materials, images, and the BMaxy name and visual identity — is protected by copyright and intellectual property law and belongs to ${NAME} or to the author, as the case may be.`,
        },
        {
          type: "text",
          text: "When you buy an access plan, you receive a personal, non-transferable, non-exclusive, revocable license to watch the content for your own, non-commercial use. The license transfers ownership of nothing.",
        },
        {
          type: "text",
          text: "Without written permission, you may not:",
        },
        {
          type: "list",
          items: [
            "record, download, copy, or reproduce the lessons by any means;",
            "share, resell, assign, or publish the content, in whole or in part;",
            "show the lessons to a class, training session, group, or any collective setting;",
            "share your account access with anyone else.",
          ],
        },
        {
          type: "text",
          text: "The author's published books carry their own rights, and nothing in these Terms grants a license over them.",
        },
      ],
    },
    {
      id: "acceptable-use",
      number: "11",
      heading: "Acceptable use",
      blocks: [
        {
          type: "text",
          text: "When using the site and the student area, you agree not to:",
        },
        {
          type: "list",
          items: [
            "use the service for anything unlawful or that infringes someone else's rights;",
            "try to bypass access control, the sequential unlocking of lessons, or any security measure;",
            "reach areas, accounts, or data that aren't yours;",
            "extract content automatically (bots, scraping, bulk copying);",
            "overload, interfere with, or attempt to compromise the site's infrastructure;",
            "impersonate another person or BMaxy itself.",
          ],
        },
      ],
    },
    {
      id: "termination",
      number: "12",
      heading: "Suspending and closing access",
      blocks: [
        {
          type: "text",
          text: "BMaxy may suspend or close access for an account that breaches these Terms — particularly in cases of shared access, copying or redistributing the content, payment fraud, or attempts to bypass lesson controls.",
        },
        {
          type: "text",
          text: "Whenever possible, we warn you by email first and give you a chance to put things right.",
        },
        {
          type: "note",
          text: "What a suspension for breach means for money already paid has not been defined yet. Until this clause is finalized, each case is handled by email, alongside the refund clause — which is also provisional.",
        },
        {
          type: "text",
          text: `You can close your account whenever you want by writing to ${EMAIL}.`,
        },
      ],
    },
    {
      id: "third-parties",
      number: "13",
      heading: "Third-party services",
      blocks: [
        {
          type: "text",
          text: "The site and the student area rely on services operated by third parties:",
        },
        {
          type: "list",
          items: [
            "Supabase — authentication, database, and login session.",
            "YouTube (Google) — hosting and playback of the lesson videos, shown inside the student area through YouTube's embedded player.",
            "Stripe — card payment processing, once enrollment opens.",
            "Hosting provider — application infrastructure and site delivery.",
          ],
        },
        {
          type: "text",
          text: "Using those services is subject to each provider's own terms and policies. BMaxy is not responsible for their downtime, rule changes, or failures. How they handle personal data is described in the Privacy Policy.",
        },
      ],
    },
    {
      id: "liability",
      number: "14",
      heading: "Availability and limitation of liability",
      blocks: [
        {
          type: "text",
          text: "The course is educational material. It teaches a way of working and shows routes to publication, but it does not guarantee that you will finish a book, publish it, sell it, be accepted by a publisher, or earn anything at all. The outcome depends on your work and on factors outside our control.",
        },
        {
          type: "text",
          text: "Nothing on this site is legal, accounting, tax, or investment advice.",
        },
        {
          type: "text",
          text: "To the fullest extent permitted by applicable law, the site and its content are provided as is, and BMaxy's liability for any claim related to the course is limited to the amount you actually paid for access. This limit does not remove rights granted by the law where you live that cannot be waived by contract.",
        },
      ],
    },
    {
      id: "privacy",
      number: "15",
      heading: "Privacy and communications",
      blocks: [
        {
          type: "text",
          text: "How we handle your personal data is described in the Privacy Policy, which forms part of these Terms.",
        },
        {
          type: "text",
          text: "We use your registered email for operational messages: signup confirmation, password recovery, course notices, and notices about relevant changes to these documents. Promotional messages are only sent with your consent, and always with a clear way to opt out.",
        },
      ],
    },
    {
      id: "changes",
      number: "16",
      heading: "Changes to these Terms and to the service",
      blocks: [
        {
          type: "text",
          text: "These Terms may be updated. The date of the latest update always sits at the top of this page.",
        },
        {
          type: "text",
          text: "When a change is material — particularly to access, payment, or refund rules — we will tell you by email or through a visible notice on the site before it takes effect. Continuing to use the service after that means accepting the new version.",
        },
        {
          type: "text",
          text: "BMaxy may also change, add, or remove parts of the site and the course. If a change materially reduces what you purchased, we will tell you by email.",
        },
      ],
    },
    {
      id: "law",
      number: "17",
      heading: "Governing law and venue",
      blocks: [
        {
          type: "text",
          text: "These Terms are governed by the laws of the state of Florida, United States, without regard to its conflict-of-law rules.",
        },
        {
          type: "text",
          text: "The competent courts located in the state of Florida are the agreed venue for any matter arising from these Terms.",
        },
        {
          type: "text",
          text: "If you are a consumer and the law where you live grants rights or a venue that cannot be waived by contract, those rights still apply.",
        },
      ],
    },
    {
      id: "contact",
      number: "18",
      heading: "Contact",
      blocks: [
        {
          type: "text",
          text: "Questions about these Terms, refund requests, and account closure all go to the same address:",
        },
        {
          type: "list",
          items: [NAME, `${ADDRESS} — United States`, EMAIL],
        },
      ],
    },
  ],
};

const privacyEn: LegalDocument = {
  meta: {
    title: "Privacy Policy",
    description:
      "How BMAXY LLC handles your data: what we collect, strictly essential cookies, who we share it with, how long we keep it, and how to exercise your rights.",
  },
  eyebrow: "Legal",
  title: "Privacy Policy",
  lead: "What BMaxy collects, why, who it's shared with, and what you can ask for at any time. No trackers, no advertising, no selling of data.",
  updatedLabel: "Last updated",
  updatedAt: "August 4, 2026",
  updatedAtISO: UPDATED_ISO,
  summaryLabel: "On this page",
  contactNote:
    "To access, correct, or delete your data — or to ask anything about this policy — write to us directly. Every request about personal data goes through this address.",
  contactCta: "Email BMaxy",

  sections: [
    {
      id: "controller",
      number: "01",
      heading: "Who is responsible for your data",
      blocks: [
        {
          type: "text",
          text: `The personal data handled on this site is the responsibility of ${NAME}, a company formed in the state of Florida, United States.`,
        },
        {
          type: "list",
          items: [
            `Business address: ${ADDRESS}, United States.`,
            `Email for privacy matters: ${EMAIL}.`,
          ],
        },
        {
          type: "text",
          text: "BMaxy does not currently have a named data protection officer. Every request, question, or complaint about personal data should go to the address above, which is the official channel.",
        },
      ],
    },
    {
      id: "scope",
      number: "02",
      heading: "What this policy covers",
      blocks: [
        {
          type: "text",
          text: "This policy applies to bmaxy.com — in both its Portuguese and English versions — and to the student area of the Write Your Book course.",
        },
        {
          type: "text",
          text: "It does not cover third-party sites you reach from here, such as the stores where the books are sold and the social media profiles. Each of those has its own policy, and that policy is what applies there.",
        },
      ],
    },
    {
      id: "data-collected",
      number: "03",
      heading: "What data we collect",
      blocks: [
        {
          type: "text",
          text: "We collect only what the site and the student area need in order to work:",
        },
        {
          type: "list",
          items: [
            "Account data: full name, email address, and password. The password is stored encrypted by Supabase — BMaxy cannot see it or recover it.",
            "The language preference set on your account (Portuguese or English).",
            "Course usage data: your enrollment, which lessons you completed, when you completed them, and the progress the player records while a video plays.",
            "Technical logs generated automatically by the infrastructure providers — such as IP address, date and time of access, and browser type — used to run and protect the service.",
            "The content of the messages you send us by email, along with the address they came from.",
          ],
        },
        {
          type: "text",
          text: "We don't ask for identity documents, we don't collect sensitive data, and we don't build behavioral profiles. No automated decision with legal effect is made about you — unlocking lessons in order is a course rule, not an assessment of who you are.",
        },
        {
          type: "note",
          text: "Payment data: none today. The site processes no charges. When card payments go live, they will be processed by Stripe — card details go directly to Stripe, and BMaxy stores no card number, security code, or bank details.",
        },
      ],
    },
    {
      id: "purposes",
      number: "04",
      heading: "What we use it for",
      blocks: [
        {
          type: "list",
          items: [
            "Creating and maintaining your account and letting you log in.",
            "Giving access to the course and unlocking lessons in the right order.",
            "Recording lesson completion and, once the criteria exist, issuing the certificate of completion.",
            "Replying to the messages you send.",
            "Keeping the service secure, preventing fraud, and investigating misuse.",
            "Meeting the legal, tax, and accounting obligations that apply to the company.",
          ],
        },
        {
          type: "text",
          text: "We don't use your data for targeted advertising, and we don't sell, rent, or hand it over to third parties for commercial purposes.",
        },
      ],
    },
    {
      id: "cookies",
      number: "05",
      heading: "Cookies",
      blocks: [
        {
          type: "text",
          text: "The site uses strictly essential cookies only: the session cookies Supabase creates when you log in. Without them, there is no way to keep you signed in from one page to the next.",
        },
        {
          type: "text",
          text: "We use no analytics, advertising, or tracking cookies, and no audience measurement tool is installed on the site. That's why you don't see a consent banner: there is nothing to consent to beyond what the service needs to function.",
        },
        {
          type: "text",
          text: "There is one exception that comes from outside: when you watch a lesson, the YouTube player is loaded from YouTube's servers. At that point Google may set cookies and collect data in your browser under its own policies — this happens inside the student area, not on the public pages of the site.",
        },
        {
          type: "text",
          text: "You can block or delete cookies in your browser settings. If you block the session cookies, logging in stops working.",
        },
      ],
    },
    {
      id: "sharing",
      number: "06",
      heading: "Who we share it with",
      blocks: [
        {
          type: "text",
          text: "We don't sell personal data. We share only what's necessary, and only with the providers that run parts of the service:",
        },
        {
          type: "list",
          items: [
            "Supabase — authentication, database, and session. This is where your account and your course progress are stored.",
            "YouTube (Google) — hosting and playback of the lesson videos.",
            "Hosting provider — application infrastructure and site delivery, which generates the technical access logs.",
            "Stripe — card payment processing, once enrollment opens.",
            "Public authorities, where there is a legal obligation or court order.",
          ],
        },
        {
          type: "text",
          text: "Each of these services handles data under its own privacy policy. If you'd like the current list of providers in use, ask us by email.",
        },
      ],
    },
    {
      id: "international",
      number: "07",
      heading: "International transfers",
      blocks: [
        {
          type: "text",
          text: `${NAME} is based in the United States, and the providers listed above may process data on servers located outside your country.`,
        },
        {
          type: "text",
          text: "By creating an account and using the service, you understand that your data may be transferred to, stored in, and processed in the United States and in other countries where those providers operate.",
        },
      ],
    },
    {
      id: "retention",
      number: "08",
      heading: "How long we keep it",
      blocks: [
        {
          type: "text",
          text: "Account and progress data is kept for as long as your account exists. If you ask us to delete the account, we erase whatever we are not required to keep.",
        },
        {
          type: "text",
          text: "After closure, we keep only what is needed to meet a legal, tax, or accounting obligation and to defend against a possible claim. Technical logs generated by the providers follow each provider's own retention period.",
        },
        {
          type: "note",
          text: "We don't publish a fixed number of days here: it depends on the legal obligation that applies to each type of record, and it is still being defined. If you want to know the period that applies to your case, ask us by email.",
        },
      ],
    },
    {
      id: "security",
      number: "09",
      heading: "How we protect your data",
      blocks: [
        {
          type: "list",
          items: [
            "Passwords are stored encrypted by Supabase; nobody at BMaxy can read them.",
            "Database access is restricted by row-level security rules enforced in the database itself, not only by the site's code.",
            "The video for a locked lesson is never delivered to the browser: the video address only leaves the server for someone who has already unlocked that lesson.",
            "Traffic between your browser and the site is encrypted (HTTPS).",
          ],
        },
        {
          type: "text",
          text: "Even so, no system is completely immune. If a security incident occurs that could affect you, we will notify you at your registered email address and take the appropriate steps.",
        },
      ],
    },
    {
      id: "your-rights",
      number: "10",
      heading: "Your rights and how to use them",
      blocks: [
        {
          type: "text",
          text: "Depending on where you live, local law — such as the LGPD in Brazil, the GDPR in Europe, or state laws in the United States — may grant you rights over your data. Whichever law applies to you, BMaxy offers every user the right to:",
        },
        {
          type: "list",
          items: [
            "find out what data of yours we hold and get a copy of it;",
            "correct data that is incomplete, out of date, or wrong;",
            "ask us to delete your account and any data we are not legally required to keep;",
            "withdraw a consent you have given, without affecting what was done before;",
            "object to a specific use of your data or ask that it be restricted;",
            "complain to the data protection authority in your country.",
          ],
        },
        {
          type: "text",
          text: `To exercise any of these, write to ${EMAIL} from the email address registered on your account. We may ask for extra information to confirm your identity before acting — it's a safeguard against requests made by someone else. We reply as soon as we can and, where the law in your country sets a deadline, within it.`,
        },
      ],
    },
    {
      id: "children",
      number: "11",
      heading: "Children and teenagers",
      blocks: [
        {
          type: "text",
          text: "The site and the student area are not directed at children. Creating an account requires being 18 or older, or having the consent and supervision of a legal guardian.",
        },
        {
          type: "text",
          text: "If we find an account created by a child without a guardian's consent, we delete the data. If you are a guardian and believe this has happened, write to our contact address.",
        },
      ],
    },
    {
      id: "email",
      number: "12",
      heading: "Emails you receive",
      blocks: [
        {
          type: "text",
          text: "Today we only send operational messages: signup confirmation, password recovery, course notices, and notices about relevant changes to the legal documents. There is no marketing email list in operation.",
        },
        {
          type: "text",
          text: "If we start sending promotional content, it will only go to people who consented, and every message will carry a clear way to unsubscribe. Operational messages tied to your account keep being sent for as long as the account exists.",
        },
      ],
    },
    {
      id: "changes",
      number: "13",
      heading: "Changes to this policy",
      blocks: [
        {
          type: "text",
          text: "This policy may be updated — for example, when a new provider comes into use or when Stripe payments go live. The date of the latest update always sits at the top of this page.",
        },
        {
          type: "text",
          text: "When a change matters to you, we will tell you at your registered email address or through a visible notice on the site before it takes effect.",
        },
      ],
    },
    {
      id: "contact",
      number: "14",
      heading: "Contact",
      blocks: [
        {
          type: "text",
          text: "Requests about personal data and questions about this policy are handled by:",
        },
        {
          type: "list",
          items: [NAME, `${ADDRESS} — United States`, EMAIL],
        },
      ],
    },
  ],
};

/* ------------------------------- exportação ------------------------------- */

export const legalContent: Record<Locale, LegalContent> = {
  pt: { terms: termsPt, privacy: privacyPt },
  en: { terms: termsEn, privacy: privacyEn },
};
