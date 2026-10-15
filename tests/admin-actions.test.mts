import assert from "node:assert/strict";
import test from "node:test";
import {
  createFakeClient,
  formDataOf,
  requireAdminCalls,
  requireAdminSeq,
  nextSeq,
  resetHarness,
  skipWithoutStubs,
  stubAdminClient,
  stubSupabase,
  type FakeOp,
  type FakeResult,
} from "./action-harness.mts";

/**
 * Dois estados pela metade que estas actions produziam:
 *
 *   1. createStudentAction criava o usuário no Auth e, se o passo seguinte
 *      falhasse, ia embora deixando uma CONTA ZUMBI — usuário sem perfil,
 *      invisível no painel, com o e-mail preso para sempre ("e-mail já
 *      existe" em toda tentativa seguinte);
 *   2. criar módulo/aula lia a próxima posição e inseria em duas chamadas
 *      separadas. Dois admins ao mesmo tempo recebiam o mesmo order_index e a
 *      segunda criação morria no unique (23505) com um "não foi possível
 *      criar" que não dizia nada — sendo que bastava recalcular e repetir.
 */

const NOVO_ALUNO_ID = "22222222-2222-4222-8222-222222222222";
const COURSE_ID = "33333333-3333-4333-8333-333333333333";
const MODULE_ID = "44444444-4444-4444-8444-444444444444";
const EMAIL = "aluno@exemplo.com";

async function adminActions() {
  return import("@/lib/actions/admin");
}

/* ==========================================================================
   createStudentAction — rollback da conta pela metade
   ========================================================================== */

type AlunoCenario = {
  /** Erro do createUser. Quando presente, nenhum usuário é criado. */
  createError?: unknown;
  /** Resposta do UPDATE em profiles. */
  profileResult?: FakeResult;
  /** Erro devolvido pelo deleteUser (rollback que não funciona). */
  deleteError?: unknown;
  /** deleteUser estourando (rede/timeout). */
  deleteThrows?: boolean;
};

function montarCriacaoDeAluno(cenario: AlunoCenario) {
  const excluidos: string[] = [];
  /* Sequência das chamadas de auth.admin. Elas não passam pelo cliente falso
     de tabelas, então precisam entrar na linha do tempo por conta própria —
     senão uma asserção de ordem não enxerga a criação do usuário, que é
     justamente a operação mais perigosa desta action. */
  const seqAuth: number[] = [];

  const admin = createFakeClient(
    (op: FakeOp): FakeResult => {
      if (op.table === "profiles") return cenario.profileResult ?? { data: { id: NOVO_ALUNO_ID } };
      return { data: null, error: null };
    },
    {
      admin: {
        createUser: async () => {
          seqAuth.push(nextSeq());
          return {
            data: { user: cenario.createError ? null : { id: NOVO_ALUNO_ID } },
            error: cenario.createError ?? null,
          };
        },
        deleteUser: async (id: string) => {
          seqAuth.push(nextSeq());
          excluidos.push(id);
          if (cenario.deleteThrows) throw new Error("fetch failed");
          return { data: null, error: cenario.deleteError ?? null };
        },
      },
    },
  );

  const supabase = createFakeClient(() => ({ data: null, error: null }));
  stubSupabase(supabase);
  stubAdminClient(() => admin);

  const formData = formDataOf({
    fullName: "Maria Silva",
    email: EMAIL,
    temporaryPassword: "test-password-123",
  });

  return { admin, supabase, formData, excluidos, seqAuth };
}

test("cadastro completo: perfil nomeado, senha temporária e nada apagado", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const { admin, supabase, formData, excluidos, seqAuth } = montarCriacaoDeAluno({});
  const { createStudentAction } = await adminActions();

  const state = await createStudentAction(undefined, formData);

  assert.ok(state?.success, `esperava sucesso, veio ${JSON.stringify(state)}`);
  assert.equal(requireAdminCalls(), 1, "requireAdmin é chamado uma vez");

  /* Contar chamadas não prova ordem: uma reescrita que chamasse requireAdmin
     DEPOIS de criar o usuário passaria pela asserção acima igual. O que
     importa é que a guarda venha antes de qualquer toque em dado — por isso a
     comparação de posição na sequência global. */
  const primeiraOperacao = Math.min(
    ...[...admin.calls, ...supabase.calls].map((op) => op.seq ?? Infinity),
    ...seqAuth,
  );
  const guarda = requireAdminSeq();
  assert.ok(guarda !== null, "requireAdmin precisa ter sido chamado");
  assert.ok(
    guarda < primeiraOperacao,
    `requireAdmin (seq ${guarda}) tem que vir antes da primeira operação de dado (seq ${primeiraOperacao})`,
  );
  assert.deepEqual(excluidos, [], "não pode apagar nada quando deu tudo certo");

  const update = admin.calls.find((op) => op.table === "profiles" && op.kind === "update");
  assert.ok(update, "o perfil precisa ser completado");
  assert.deepEqual(update.payload, {
    full_name: "Maria Silva",
    // Nasce obrigada a trocar a senha: quem a conhece hoje é o administrador.
    must_change_password: true,
  });
  assert.equal(update.filters.id, NOVO_ALUNO_ID);

  // Conta criada pelo painel NÃO ganha matrícula automática.
  const matriculas = [...admin.calls, ...supabase.calls].filter(
    (op) => op.table === "enrollments",
  );
  assert.deepEqual(matriculas, []);
});

test("perfil que falha derruba o usuário que ESTA execução criou", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const { formData, excluidos } = montarCriacaoDeAluno({
    profileResult: { error: { code: "08006", message: "connection failure" } },
  });
  const { createStudentAction } = await adminActions();

  const state = await createStudentAction(undefined, formData);

  assert.deepEqual(excluidos, [NOVO_ALUNO_ID], "apaga exatamente o id recém-criado");
  assert.ok(state?.error);
  // Rollback deu certo: não sobrou nada, e a mensagem não pode assustar
  // ninguém com uma conta inconsistente que não existe.
  assert.match(state.error, /nada foi salvo/i);
  assert.equal(state.error.includes(EMAIL), false);
  assert.equal(state.error.includes("connection failure"), false);
});

test("perfil que não encontra linha também dispara o rollback", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  // UPDATE sem match volta sem erro: era assim que "aluno criado" saía para um
  // perfil que não existia.
  const { formData, excluidos } = montarCriacaoDeAluno({
    profileResult: { data: null, error: null },
  });
  const { createStudentAction } = await adminActions();

  const state = await createStudentAction(undefined, formData);

  assert.deepEqual(excluidos, [NOVO_ALUNO_ID]);
  assert.ok(state?.error);
});

test("e-mail já cadastrado NÃO apaga a conta de quem já existe", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  /* O caso mais perigoso: a criação falha porque o e-mail é de outra pessoa.
   * Um rollback ingênuo (por e-mail, ou "limpa o que atrapalha") apagaria o
   * cadastro alheio por causa de um formulário digitado duas vezes. */
  const { formData, excluidos, admin } = montarCriacaoDeAluno({
    createError: {
      name: "AuthApiError",
      message: "A user with this email address has already been registered",
      status: 422,
      code: "email_exists",
    },
  });
  const { createStudentAction } = await adminActions();

  const state = await createStudentAction(undefined, formData);

  assert.deepEqual(excluidos, [], "nenhuma exclusão pode acontecer aqui");
  assert.equal(admin.calls.length, 0, "nem deveria mexer em profiles");
  assert.ok(state?.error);
  assert.equal(
    state.error.includes("already been registered"),
    false,
    "não ecoa o texto do provedor",
  );
});

test("rollback que falha avisa qual e-mail ficou pendente", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const { formData, excluidos } = montarCriacaoDeAluno({
    profileResult: { error: { message: "boom" } },
    deleteError: { message: "User not found", status: 404 },
  });
  const { createStudentAction } = await adminActions();

  const state = await createStudentAction(undefined, formData);

  assert.deepEqual(excluidos, [NOVO_ALUNO_ID], "tentou apagar");
  assert.ok(state?.error);
  // Sobrou conta inconsistente: quem está na tela precisa saber disso e sobre
  // qual e-mail, senão o problema só reaparece no próximo cadastro.
  assert.ok(state.error.includes(EMAIL), "a mensagem precisa citar o e-mail");
  assert.match(state.error, /à mão|manual/i);
  // O id interno não ajuda quem vai resolver isso no painel do Supabase.
  assert.equal(state.error.includes(NOVO_ALUNO_ID), false);
});

test("rollback que estoura por rede é tratado como rollback falho", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const { formData } = montarCriacaoDeAluno({
    profileResult: { error: { message: "boom" } },
    deleteThrows: true,
  });
  const { createStudentAction } = await adminActions();

  const state = await createStudentAction(undefined, formData);

  // Exceção engolida aqui produziria de novo a conta zumbi silenciosa.
  assert.ok(state?.error);
  assert.ok(state.error.includes(EMAIL));
});

/* ==========================================================================
   createModuleAction / createLessonAction — criação atômica
   ==========================================================================

   Estes testes substituíram os de "colisão de order_index". Aqueles cobriam um
   laço que recalculava a posição e repetia o INSERT em 23505 — cautela
   necessária enquanto a posição vinha de `next_module_order()` numa chamada
   separada da escrita.

   A corrida foi resolvida no banco (20260804201803_atomic_content_creation):
   `create_module`/`create_lesson` calculam a posição dentro do mesmo comando
   que grava a linha, sob advisory lock do pai. O laço deixou de ter o que
   tratar, e testar um laço que não existe mais seria testar a ausência de um
   bug pelo caminho errado.

   O que importa agora é que a action NÃO monte a posição por conta própria. */

test("criar módulo é uma chamada só, sem posição calculada no cliente", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const client = createFakeClient((op: FakeOp): FakeResult =>
    op.kind === "rpc" ? { data: "novo-modulo-id" } : { data: null, error: null },
  );
  stubSupabase(client);

  const { createModuleAction } = await adminActions();
  const state = await createModuleAction(
    undefined,
    formDataOf({ courseId: COURSE_ID, titlePt: "Módulo", titleEn: "Module" }),
  );

  assert.ok(state?.success, `esperava sucesso, veio ${JSON.stringify(state)}`);

  const rpcs = client.calls.filter((op) => op.kind === "rpc");
  assert.equal(rpcs.length, 1, "uma chamada, não uma leitura seguida de escrita");
  assert.equal(rpcs[0].fn, "create_module");
  assert.deepEqual(rpcs[0].args, {
    p_course_id: COURSE_ID,
    p_title_pt: "Módulo",
    p_title_en: "Module",
  });

  // O ponto todo: nenhum INSERT direto, logo nenhum order_index escolhido
  // aqui. Quem numera é o banco, segurando o lock.
  assert.equal(
    client.calls.filter((op) => op.kind === "insert").length,
    0,
    "a action não insere na tabela direto",
  );
});

test("falha do banco ao criar módulo não vira sucesso", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  stubSupabase(
    createFakeClient((op: FakeOp): FakeResult =>
      op.kind === "rpc"
        ? { error: { code: "42501", message: "Apenas administradores podem criar modulos." } }
        : { data: null, error: null },
    ),
  );

  const { createModuleAction } = await adminActions();
  const state = await createModuleAction(
    undefined,
    formDataOf({ courseId: COURSE_ID, titlePt: "Módulo", titleEn: "Module" }),
  );

  assert.ok(state?.error);
  assert.equal(state.error, "Não foi possível criar o módulo.");
  // A mensagem crua do Postgres não chega à tela.
  assert.doesNotMatch(state.error, /42501|administradores podem/i);
});

test("criar aula é uma chamada só, e o status não vem do cliente", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const client = createFakeClient((op: FakeOp): FakeResult =>
    op.kind === "rpc" ? { data: "nova-aula-id" } : { data: null, error: null },
  );
  stubSupabase(client);

  const { createLessonAction } = await adminActions();
  const state = await createLessonAction(
    undefined,
    formDataOf({
      moduleId: MODULE_ID,
      courseId: COURSE_ID,
      titlePt: "Aula",
      titleEn: "Lesson",
    }),
  );

  assert.ok(state?.success, `esperava sucesso, veio ${JSON.stringify(state)}`);

  const rpcs = client.calls.filter((op) => op.kind === "rpc");
  assert.equal(rpcs.length, 1);
  assert.equal(rpcs[0].fn, "create_lesson");

  /* "Nasce como rascunho" deixou de ser escolha de quem chama e virou regra do
     banco: a função nem aceita `status`. Se alguém reintroduzir o parâmetro
     aqui, volta a ser possível publicar uma aula no instante da criação — e
     ela entraria na sequência do aluno sem título revisado e sem vídeo. */
  assert.deepEqual(rpcs[0].args, {
    p_module_id: MODULE_ID,
    p_title_pt: "Aula",
    p_title_en: "Lesson",
  });
  assert.equal(
    client.calls.filter((op) => op.kind === "insert").length,
    0,
    "a action não insere na tabela direto",
  );
});
