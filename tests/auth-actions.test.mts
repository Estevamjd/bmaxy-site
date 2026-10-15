import assert from "node:assert/strict";
import test from "node:test";
import {
  captureRedirect,
  createFakeClient,
  formDataOf,
  resetHarness,
  skipWithoutStubs,
  stubAdminClient,
  stubSupabase,
  type FakeOp,
  type FakeResult,
} from "./action-harness.mts";

/**
 * Duas mentiras que estas actions contavam:
 *
 *   1. o login dizia "e-mail ou senha incorretos" para QUALQUER falha —
 *      inclusive rate limit (429). Numa auditoria isso já custou horas
 *      procurando problema numa senha que estava certa;
 *   2. a redefinição de senha redirecionava como sucesso mesmo quando a
 *      baixa da flag `must_change_password` falhava, deixando a pessoa presa
 *      no laço "troque a senha" sem explicação.
 *
 * Os testes abaixo rodam as actions DE PRODUÇÃO (ver tests/action-harness.mts).
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SENHA = "senha-nova-123";

async function authActions() {
  return import("@/lib/actions/auth");
}

/** Erro no formato que o supabase-js entrega (AuthApiError). */
function authError(code: string | undefined, status: number | undefined, message: string) {
  return { name: "AuthApiError", message, status, code };
}

/* ==========================================================================
   loginAction — a causa da falha
   ========================================================================== */

/** Roda o login contra um signInWithPassword que falha com este erro. */
async function loginFailureMessage(error: unknown): Promise<string> {
  resetHarness();
  const client = createFakeClient(
    () => ({ data: null, error: null }),
    {
      signInWithPassword: async () => ({ data: { user: null, session: null }, error }),
    },
  );
  stubSupabase(client);

  const { loginAction } = await authActions();
  const state = await loginAction(
    undefined,
    formDataOf({ email: "maria@exemplo.com", password: "seja-o-que-for" }),
  );

  // Falhou o login: nada mais pode ter sido consultado no banco.
  assert.equal(client.calls.length, 0, "não deveria consultar nada após falhar");
  assert.ok(state?.error, "a action precisa devolver um erro");
  return state.error;
}

const CREDENCIAL_INVALIDA = "E-mail ou senha incorretos.";

test("credencial inválida mantém a mensagem de sempre", { skip: skipWithoutStubs }, async () => {
  const mensagem = await loginFailureMessage(
    authError("invalid_credentials", 400, "Invalid login credentials"),
  );
  assert.equal(mensagem, CREDENCIAL_INVALIDA);
});

test("rate limit não é mais reportado como senha errada", { skip: skipWithoutStubs }, async () => {
  const mensagem = await loginFailureMessage(
    authError("over_request_rate_limit", 429, "Request rate limit reached"),
  );
  assert.notEqual(mensagem, CREDENCIAL_INVALIDA);
  assert.match(mensagem, /tentativas/i);
  assert.match(mensagem, /minutos/i);
});

test("429 sem código também é tratado como rate limit", { skip: skipWithoutStubs }, async () => {
  // Nem toda resposta do gateway traz `code`; o status sozinho já basta.
  const mensagem = await loginFailureMessage(authError(undefined, 429, "Too Many Requests"));
  assert.notEqual(mensagem, CREDENCIAL_INVALIDA);
  assert.match(mensagem, /tentativas/i);
});

test("e-mail não confirmado orienta a confirmar", { skip: skipWithoutStubs }, async () => {
  const mensagem = await loginFailureMessage(
    authError("email_not_confirmed", 400, "Email not confirmed"),
  );
  assert.notEqual(mensagem, CREDENCIAL_INVALIDA);
  assert.match(mensagem, /confirme/i);
});

test("erro inesperado vira falha temporária e não vaza o texto interno", { skip: skipWithoutStubs }, async () => {
  const mensagem = await loginFailureMessage(
    authError(
      "unexpected_failure",
      500,
      'relation "public.user_roles" does not exist (SQLSTATE 42P01)',
    ),
  );
  assert.equal(mensagem.includes("relation"), false, "não pode ecoar o erro do Postgres");
  assert.equal(mensagem.includes("SQLSTATE"), false);
  assert.notEqual(mensagem, CREDENCIAL_INVALIDA);
  assert.match(mensagem, /não foi possível entrar/i);
});

test("sucesso sem usuário não vira 'senha errada'", { skip: skipWithoutStubs }, async () => {
  // error null e user null: estado que não deveria acontecer. Chutar
  // "senha incorreta" aqui seria repetir o defeito original.
  const mensagem = await loginFailureMessage(null);
  assert.notEqual(mensagem, CREDENCIAL_INVALIDA);
});

test("e-mail inexistente e senha errada dão exatamente a mesma resposta", { skip: skipWithoutStubs }, async () => {
  /* A garantia anti-enumeração: o que distingue os dois casos, no Supabase, é
   * só o texto interno da mensagem — o código é o mesmo. Se algum dia alguém
   * repassar `error.message` para a tela, o login vira um verificador de
   * "quem tem conta aqui" e este teste quebra. */
  const senhaErrada = await loginFailureMessage(
    authError("invalid_credentials", 400, "Invalid login credentials"),
  );
  const emailInexistente = await loginFailureMessage(
    authError("invalid_credentials", 400, "User not found"),
  );

  assert.equal(senhaErrada, emailInexistente);
  assert.equal(emailInexistente.includes("not found"), false);
});

test("nenhum código de erro faz o texto interno vazar para a tela", { skip: skipWithoutStubs }, async () => {
  /* O teste acima, sozinho, é fraco: os dois casos chegam com o MESMO `code`,
   * e o mapeador decide por código — a igualdade é garantida por construção.
   * Ele protege contra alguém repassar `error.message`, mas prova pouco.
   *
   * Este aqui prova a propriedade que realmente importa e que vale para
   * qualquer entrada: seja qual for o código, o texto interno do Supabase
   * NUNCA aparece na resposta. É o que impede o login de virar oráculo,
   * independentemente de o provedor mudar mensagem ou código.
   *
   * O que continua fora do alcance de teste unitário: a garantia de que o
   * GoTrue devolve `invalid_credentials` tanto para e-mail inexistente quanto
   * para senha errada. Isso é contrato do provedor, não invariante deste
   * código — está registrado em docs/QA-CHECKLIST.md como verificação manual. */
  const segredo = "zz-texto-interno-que-nao-pode-vazar";
  const codigos = [
    "invalid_credentials",
    "email_not_confirmed",
    "over_request_rate_limit",
    "user_banned",
    "codigo_que_ainda_nao_existe",
    null,
  ];

  for (const code of codigos) {
    for (const status of [400, 401, 429, 500]) {
      const mensagem = await loginFailureMessage(authError(code, status, segredo));
      assert.equal(
        mensagem.includes(segredo),
        false,
        `o texto interno vazou para code=${code} status=${status}: ${mensagem}`,
      );
      assert.ok(mensagem.length > 0, `code=${code} status=${status} ficou sem mensagem`);
    }
  }
});

/* ==========================================================================
   resetPasswordAction — não fingir sucesso
   ========================================================================== */

type ResetCenario = {
  /** Resposta do UPDATE em profiles feito pelo cliente de service role. */
  flagResult?: FakeResult;
  /** Erro do auth.updateUser (troca de senha em si). */
  passwordError?: unknown;
  /** Faz createAdminClient() lançar, como quando falta SUPABASE_SECRET_KEY. */
  adminIndisponivel?: boolean;
  extraFields?: Record<string, string>;
};

function montarReset(cenario: ResetCenario) {
  const supabase = createFakeClient(
    (op: FakeOp): FakeResult => {
      if (op.table === "user_roles") return { data: { role: "student" } };
      return { data: null, error: null };
    },
    {
      getUser: async () => ({ data: { user: { id: USER_ID } }, error: null }),
      updateUser: async () => ({
        data: { user: { id: USER_ID } },
        error: cenario.passwordError ?? null,
      }),
    },
  );

  const admin = createFakeClient(() => cenario.flagResult ?? { data: { id: USER_ID } });

  let adminCriado = 0;
  stubSupabase(supabase);
  stubAdminClient(() => {
    adminCriado += 1;
    if (cenario.adminIndisponivel) {
      throw new Error("Supabase admin não configurado: defina SUPABASE_SECRET_KEY");
    }
    return admin;
  });

  const formData = formDataOf({
    password: SENHA,
    confirmPassword: SENHA,
    ...cenario.extraFields,
  });

  return { supabase, admin, formData, adminCriado: () => adminCriado };
}

/** Atualizações da flag feitas pelo cliente de service role. */
function updatesDeProfiles(client: { calls: FakeOp[] }): FakeOp[] {
  return client.calls.filter((op) => op.table === "profiles" && op.kind === "update");
}

test("senha trocada e flag baixada: segue para a área do aluno", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const { supabase, admin, formData } = montarReset({});
  const { resetPasswordAction } = await authActions();

  const destino = await captureRedirect(() => resetPasswordAction(undefined, formData));
  assert.equal(destino, "/aluno");

  const updates = updatesDeProfiles(admin);
  assert.equal(updates.length, 1, "a flag precisa ser baixada uma vez");
  assert.deepEqual(updates[0].payload, { must_change_password: false });
  assert.equal(updates[0].filters.id, USER_ID);

  /* A coluna must_change_password é revogada de `authenticated` justamente
   * para o aluno não conseguir apagar a própria flag por um PATCH direto no
   * PostgREST. Se esta escrita voltar para o cliente autenticado, ela passa a
   * falhar em produção — e este teste é o que avisa. */
  assert.equal(
    updatesDeProfiles(supabase).length,
    0,
    "a flag não pode ser escrita pelo cliente autenticado",
  );
});

test("update que não encontra a linha não é tratado como sucesso", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  // UPDATE sem match volta sem erro nenhum — é assim que o sucesso falso nascia.
  const { formData } = montarReset({ flagResult: { data: null, error: null } });
  const { resetPasswordAction } = await authActions();

  const state = await resetPasswordAction(undefined, formData);

  assert.ok(state?.error, "não pode redirecionar como se tivesse dado certo");
  // A senha JÁ mudou neste ponto: dizer que falhou tudo faria a pessoa
  // continuar tentando a senha antiga, que não vale mais.
  assert.match(state.error, /senha foi alterada/i);
  assert.match(state.error, /suporte|novamente/i);
});

test("erro do banco ao baixar a flag não vaza para a tela", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const { formData } = montarReset({
    flagResult: {
      error: {
        code: "42501",
        message: "permission denied for column must_change_password",
      },
    },
  });
  const { resetPasswordAction } = await authActions();

  const state = await resetPasswordAction(undefined, formData);

  assert.ok(state?.error);
  assert.equal(state.error.includes("permission denied"), false);
  assert.equal(state.error.includes("42501"), false);
  assert.match(state.error, /senha foi alterada/i);
});

test("service role indisponível não vira redirect de sucesso", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  const { formData } = montarReset({ adminIndisponivel: true });
  const { resetPasswordAction } = await authActions();

  const state = await resetPasswordAction(undefined, formData);

  assert.ok(state?.error, "createAdminClient lançando não pode derrubar a action");
  assert.match(state.error, /senha foi alterada/i);
});

test("a flag só é tocada DEPOIS que a troca de senha é confirmada", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  /* Ordem inegociável: se a flag caísse antes do updateUser, uma troca que
   * falhou liberaria a conta ainda com a senha temporária que o administrador
   * conhece. */
  const { admin, formData, adminCriado } = montarReset({
    passwordError: { name: "AuthApiError", message: "New password is too weak", status: 422 },
  });
  const { resetPasswordAction } = await authActions();

  const state = await resetPasswordAction(undefined, formData);

  assert.ok(state?.error);
  assert.equal(state.error, "Não foi possível redefinir a senha. Tente novamente.");
  assert.equal(adminCriado(), 0, "nem deveria abrir o cliente administrativo");
  assert.equal(admin.calls.length, 0, "a flag não pode ser baixada sem a senha ter trocado");
});

test("a linha atualizada vem da sessão, não do formulário", { skip: skipWithoutStubs }, async () => {
  resetHarness();
  // O cliente de service role ignora RLS: se o id viesse do formulário, este
  // campo seria suficiente para baixar a flag da conta de outra pessoa.
  const { admin, formData } = montarReset({
    extraFields: { userId: "99999999-9999-4999-8999-999999999999", id: "outro-id" },
  });
  const { resetPasswordAction } = await authActions();

  await captureRedirect(() => resetPasswordAction(undefined, formData));

  const updates = updatesDeProfiles(admin);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].filters.id, USER_ID);
});
