# Ativar o MVP da plataforma — checklist

Este documento existe pra outro desenvolvedor conseguir ligar login,
área do aluno e painel administrativo sem precisar adivinhar nada. Siga
na ordem.

Nada aqui afeta a home (`/` e `/en`) — ela funciona sem nenhum destes
passos.

---

## 1. Arquitetura, em resumo

- **Next.js 15 App Router**, com três "root layouts" independentes (o
  recurso de route groups do Next permite isso):
  - `src/app/(pt)/` — home em português, em `/`.
  - `src/app/en/` — home em inglês, em `/en`.
  - `src/app/(app)/` — plataforma (login, `/aluno`, `/admin`), com
    `export const dynamic = "force-dynamic"` porque são páginas de
    sessão, nunca estáticas.
- **Supabase** para autenticação, banco Postgres e sessão. Sem backend
  próprio — toda regra de acesso vive em Row Level Security (RLS) no
  banco, não só na aplicação.
- **Autorização em duas camadas**, de propósito:
  1. RLS no Postgres (`supabase/migrations/`) — a camada que não pode
     ser contornada nem por um bug na aplicação.
  2. `requireUser()` / `requireAdmin()` em `src/lib/auth/session.ts` —
     checagem no servidor (nunca no cliente) antes de renderizar
     qualquer página de `/aluno` ou `/admin`.
  O middleware (`src/middleware.ts`) só renova sessão e faz um atalho de
  UX (redireciona pra `/entrar` sem sessão nenhuma) — ele NÃO decide
  quem é admin.
- Sem as variáveis de ambiente do Supabase, a plataforma mostra um aviso
  de "em configuração" em vez de quebrar — ver `src/lib/supabase/env.ts`.

---

## 2. Dependências

Já instaladas em `package.json`:

- `@supabase/supabase-js`, `@supabase/ssr` — cliente e integração SSR do
  Supabase. **Não** use `@supabase/auth-helpers-nextjs` (depreciado).
- `zod` — validação de toda entrada de formulário e Server Action.
- `server-only` — faz o build falhar (em vez de vazar em silêncio) se
  `src/lib/supabase/admin.ts` (chave secreta) for importado por engano
  num Client Component.

```bash
npm install
```

---

## 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

| Variável | Onde pegar | Pode ir ao navegador? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Painel Supabase → Settings → API → Project URL | Sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Settings → API → chave `publishable`/`anon` | Sim — RLS protege os dados mesmo assim |
| `SUPABASE_SECRET_KEY` | Settings → API → chave `secret`/`service_role` | **Nunca.** Ignora RLS por completo. Só em `src/lib/supabase/admin.ts`, chamado só de Server Actions/Route Handlers que já checaram `requireAdmin()`. |
| `NEXT_PUBLIC_SITE_URL` | URL pública do site (local: `http://localhost:3000`) | Sim — usada pra montar o link de e-mail de recuperação de senha |

`.env.local` já está no `.gitignore`. Nunca commite esse arquivo, nunca
cole a chave secreta num PR, num log ou numa mensagem de commit.

---

## 4. Projeto Supabase atual

O projeto hospedado já existe com o nome **BMaxy** e ref
`qlrljzodmisvohjeodxt`. Email está ativo, confirmação de e-mail está ligada,
a senha mínima é de 8 caracteres e as URLs de callback autorizadas são:

- `http://localhost:3000/auth/callback`
- `https://bmaxy.com/auth/callback`
- `https://www.bmaxy.com/auth/callback`

Cada desenvolvedor ainda precisa criar seu próprio `.env.local` com as chaves
da seção 3. A chave secreta não é compartilhada pelo Git.

---

## 5. Rodar as migrations

São onze, e a ordem importa (o nome do arquivo já garante isso). Os timestamps
são os das versões efetivamente aplicadas em produção — ver `docs/MIGRATIONS.md`:

| Arquivo | O que faz |
| --- | --- |
| `20260803202658_initial_schema.sql` | As 7 tabelas, RLS em todas, `is_admin()` e o trigger que cria `profiles`/`user_roles` a cada novo usuário. |
| `20260803202701_secure_lesson_completion.sql` | `complete_lesson()` — o único caminho autorizado a marcar uma aula como concluída. RLS passa a proibir gravação direta de `completed = true`. |
| `20260803202703_private_lesson_media.sql` | Tira `video_provider`/`video_id` de `lessons` e põe em `lesson_media`, tabela sem policy nenhuma. Cria `get_lesson_playback()`. |
| `20260803203311_harden_rls_and_api_permissions.sql` | Restringe grants e policies à superfície mínima, fecha RPCs internas e otimiza RLS. |
| `20260803203841_auto_enroll_free_course.sql` | Adiciona a origem `signup` e a matrícula gratuita do cadastro público. |
| `20260803204549_scope_free_enrollment_to_public_signup.sql` | Garante que só o cadastro público recebe a matrícula automática; contas criadas pelo painel continuam sob controle do admin. |
| `20260803221619_admin_content_ordering.sql` | `move_module()`/`move_lesson()` (troca atômica de posição, só admin) e `next_module_order()`/`next_lesson_order()`. |
| `20260803221658_admin_content_ordering_search_path.sql` | Fixa `search_path = ''` nas quatro funções acima. Em produção foi correção real; num banco novo é no-op idempotente, porque a migration anterior já as cria com o valor final. Existe para preservar o histórico — ver `docs/MIGRATIONS.md`. |
| `20260804200809_harden_password_flag_and_progress.sql` | Tira `must_change_password` do grant de UPDATE de `authenticated` (o aluno apagava a própria flag por PATCH) e remove o atalho `is_admin()` do `WITH CHECK` de `lesson_progress` (o admin forjava progresso alheio). Tentou criar os `unique (course_id, order_index)` e `unique (module_id, order_index)` supondo que não existiam — existiam desde o `initial_schema`, e as duplicatas foram removidas na `20260805014918`. |
| `20260804201803_atomic_content_creation.sql` | `create_module()`/`create_lesson()` calculam a posição dentro do mesmo comando que grava a linha, com advisory lock no pai. `security invoker`, para que as policies `*_insert_admin` continuem sendo quem autoriza. `move_module`/`move_lesson` ganham o mesmo lock e releem a posição depois dele. |
| `20260805014918_drop_redundant_order_constraints.sql` | Remove `course_modules_order_unique` e `lessons_order_unique`, duplicatas criadas por engano na `20260804200809` — as originais vêm do `initial_schema` e continuam valendo. |

**Sobre a terceira**: sem ela, qualquer aluno matriculado podia pedir
`from('lessons').select('video_id')` e receber o ID do YouTube de todas as
aulas publicadas, inclusive as ainda bloqueadas pela sequência — RLS filtra
linhas, não colunas. Depois dela, o `video_id` só sai do banco por
`get_lesson_playback()`, que valida matrícula ativa, curso e aula publicados e
a conclusão de todas as aulas anteriores.

Ela **remove colunas** de `public.lessons`. O código da aplicação já espera o
esquema novo (`lessons.has_video` no lugar do `video_id`). Aplicar a migration
sem subir o código — ou o contrário — quebra as duas pontas.

Para cadastrar o vídeo de uma aula depois disso, escreva em `lesson_media`
(o trigger acerta `lessons.has_video` sozinho). Isso exige a `service_role`:
nem a sessão do administrador lê ou escreve nessa tabela pela API.

**Com a CLI do Supabase** (recomendado):

```bash
npx supabase login
npx supabase link --project-ref <seu-project-ref>
npx supabase db push
```

**Sem a CLI**: cole o conteúdo do arquivo no SQL Editor do painel
Supabase e rode.

---

## 6. Rodar o seed

`supabase/seed.sql` cria o curso "Seu Livro", o módulo "Comece aqui" e a
Aula 1 ("Por que o seu livro ainda não existe", status `coming_soon`,
sem vídeo). É idempotente — pode rodar mais de uma vez.

```bash
npx supabase db execute -f supabase/seed.sql
```

Ou cole o conteúdo no SQL Editor do painel.

---

## 7. Primeiro administrador

O administrador inicial já existe como `contact@bmaxy.com`, com a role `admin`
em `public.user_roles`. A senha **definitiva** foi definida em 2026-08-04 pelo
próprio fluxo de `/redefinir-senha` e está em `.env.admin-credentials.local`
(`BMAXY_ADMIN_EMAIL` e `BMAXY_ADMIN_PASSWORD`), arquivo ignorado pelo Git e
lido só por operador e scripts de QA — a aplicação não o lê.

`must_change_password` já está `false`, então o login cai direto em `/admin`.
Se ele estiver `true`, o login CORRETAMENTE desvia para `/redefinir-senha` e
não há como escapar navegando direto: `requireUser()` checa a flag em toda rota
protegida.

Perdeu a senha? Use `/recuperar-senha` com esse e-mail. **Não apague e recrie o
usuário** — isso derrubaria `profiles`, `user_roles` e todo o histórico.

Para criar o primeiro administrador em outro projeto/ambiente:

**Painel Supabase**: Authentication → Users → **Add user** → **Create
new user**. Preencha e-mail e senha, marque **Auto Confirm User**.

Isso já cria `profiles` e `user_roles` (role `student`) automaticamente,
via trigger.

---

## 8. Promover esse usuário a administrador

O trigger sempre cria a role `student` — promover a admin é deliberado e
manual, de propósito (ninguém se autopromove). No SQL Editor do painel:

```sql
update public.user_roles
set role = 'admin'
where user_id = (
  select id from auth.users where email = 'seu-email@exemplo.com'
);
```

Confirme o resultado:

```sql
select u.email, r.role
from auth.users u
join public.user_roles r on r.user_id = u.id
where u.email = 'seu-email@exemplo.com';
```

Agora esse e-mail/senha loga em `/entrar` e tem acesso a `/admin`.

---

## 9. Criar o aluno de demonstração

Com um administrador já ativo, use a própria aplicação:

1. Entre em `/entrar` com a conta de admin.
2. `/admin/alunos/novo` → preencha nome, e-mail e uma senha temporária
   (mínimo 8 caracteres).
3. A conta é criada com `must_change_password = true` — no primeiro
   login, o aluno é obrigado a trocar a senha antes de ver qualquer
   coisa.

---

## 10. Liberar o curso pro aluno

Em `/admin/alunos/[id]` (acessível pela lista em `/admin/alunos`),
seção **Matrículas** → escolha o curso → **Liberar curso**. O aluno
passa a ver o curso em `/aluno` imediatamente.

Pra revogar, mesmo lugar → **Revogar**.

---

## 11. Rodar localmente

```bash
npm run dev      # http://localhost:3000
```

Sem `.env.local`, a home funciona normalmente e `/entrar`, `/aluno`,
`/admin` mostram o aviso de "em configuração".

---

## 12. Lint e testes

```bash
npm run lint
npm run test:unit
```

`test:unit` roda os testes de lógica pura (desbloqueio sequencial de aula,
validação de redirecionamento) com o test runner nativo do Node — zero
dependência nova. Não precisa de Supabase. Para as regras que só um projeto
real confirma (bloqueio de conclusão fora de sequência, aula coming_soon,
proteção das rotas administrativas), siga
[docs/QA-CHECKLIST.md](QA-CHECKLIST.md).

## 13. Build

```bash
npm run build
```

Roda limpo com ou sem `.env.local` — as rotas da plataforma são
`force-dynamic` de propósito (são páginas de sessão, nunca deveriam ser
pré-renderizadas) e nunca tentam se conectar ao Supabase durante o
build.

---

## 14. Publicar

1. Suba a branch para o GitHub (sem forçar push, sem ir direto pra
   `main` — ver regras no início da tarefa).
2. Abra um Pull Request pra revisão antes de mesclar.
3. Depois de mesclado: vercel.com → **Add New… → Project** → importe o
   repositório.

## 15. Configurar no Vercel

1. **Settings → Environment Variables**: adicione as 4 variáveis da
   seção 3 (valores de produção, não os de desenvolvimento).
2. Redeploy.
3. No painel do Supabase, Authentication → URL Configuration: atualize
   **Site URL** e **Redirect URLs** para o domínio real
   (`https://bmaxy.com/auth/callback`).
4. Confirme o login do administrador, o cadastro público e os fluxos de
   matrícula no ambiente publicado.

---

## 16. Cuidados com a chave secreta

- `SUPABASE_SECRET_KEY` só existe em `.env.local` (local) e nas
  variáveis de ambiente do Vercel (produção) — nunca em código, nunca em
  commit, nunca em log.
- Só é lida em `src/lib/supabase/admin.ts`, que importa `"server-only"`
  — se algum dia esse arquivo for importado por engano num Client
  Component, o **build falha**, não vaza a chave silenciosamente.
- O cliente admin (`createAdminClient()`) só deve ser chamado de dentro
  de uma Server Action ou Route Handler que já rodou `requireAdmin()`
  antes — ele mesmo não sabe quem está pedindo.
- Se a chave vazar (commit por engano, log, etc.): gere uma nova em
  Settings → API → **Reset service_role secret** no painel Supabase e
  atualize a variável de ambiente em todo lugar que a usa.
- A partir de `20260803203311_harden_rls_and_api_permissions` o acessor da
  chave vive em `src/lib/supabase/secret.ts`, separado de
  `src/lib/supabase/env.ts`. `env.ts` é alcançável a partir de um Client
  Component (`client.ts` o importa), então ele só carrega o que é público.

## 17. Proteção contra senhas vazadas — PENDENTE, precisa do painel

O advisor de segurança do Supabase reporta `auth_leaked_password_protection`
como **desativada**. Com ela ligada, o Supabase Auth compara a senha escolhida
contra a base do HaveIBeenPwned e recusa senhas que já apareceram em
vazamentos. Isso vale para cadastro público e para a redefinição de senha.

**Não dá para ligar por migration nem pelo conector MCP** — não é schema, é
configuração do serviço de Auth, e nenhuma ferramenta segura disponível aqui
escreve nela. Precisa ser feito por quem tem acesso ao painel:

1. Abra o projeto no <https://supabase.com/dashboard>.
2. **Authentication** → **Policies** (em alguns planos aparece como
   **Sign In / Providers** → **Password**).
3. Seção **Password protection** / **Leaked password protection**.
4. Ligue **"Prevent use of leaked passwords"** e salve.

Documentação: <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>

Depois de ligar, confirme rodando o advisor de novo — o aviso
`auth_leaked_password_protection` deve sumir. Enquanto estiver desligado,
qualquer pessoa pode cadastrar uma senha conhecidamente vazada, e o único
obstáculo é o mínimo de 8 caracteres imposto pelo Zod em
`src/lib/validation/auth.ts`.
