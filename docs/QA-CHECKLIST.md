# Checklist de verificação — regras que só um Supabase real confirma

Os testes automatizados em `tests/*.test.mts` (`npm run test:unit`) cobrem a
lógica pura (desbloqueio sequencial, redirecionamento seguro) sem precisar de
banco. As regras abaixo são impostas no **Postgres** (RLS + a função
`complete_lesson()`) e só podem ser confirmadas de verdade contra um projeto
Supabase com as migrations aplicadas — não tem como simular `auth.uid()` /
sessão autenticada fora do fluxo real de Auth. Este arquivo é o roteiro pra
quem tiver esse projeto rodar e confirmar.

Pré-requisito: migrations aplicadas (`supabase/migrations/`), seed rodado
(`supabase/seed.sql`), um aluno com matrícula ativa em "Seu Livro" e um
administrador — ver `docs/SETUP-MVP.md`.

---

## 1. Bloqueio da conclusão fora de sequência

Cenário: curso com pelo menos duas aulas publicadas com vídeo (`status =
'published'` e vídeo cadastrado) — a seed só tem uma aula `coming_soon`, então
pra este teste crie temporariamente uma segunda aula publicada via
`/admin/cursos/[id]` ou SQL direto.

**`lessons` não tem mais `video_id` nem `video_provider`.** Desde
`20260803202703_private_lesson_media` o vídeo mora em `public.lesson_media`,
que é uma tabela sem policy nenhuma — nem o aluno nem o admin leem por SELECT
comum, só `get_lesson_playback()` entrega. A coluna que sobrou em `lessons` é
`has_video`, um booleano mantido por trigger; **não escreva nela à mão**, o
trigger a sobrescreve a partir de `lesson_media`.

```sql
-- Aula 1: publica e cadastra o vídeo na tabela privada.
update public.lessons set status = 'published' where id = '<id da aula 1>';

insert into public.lesson_media (lesson_id, video_provider, video_id)
values ('<id da aula 1>', 'youtube', 'dQw4w9WgXcQ')
on conflict (lesson_id) do update
  set video_provider = excluded.video_provider, video_id = excluded.video_id;

-- Aula 2: crie pela função atômica (ela nasce como rascunho na última
-- posição), depois publique e cadastre o vídeo.
select public.create_lesson('<id do módulo>', 'Aula 2 de teste', 'Test lesson 2');

update public.lessons set status = 'published' where title_pt = 'Aula 2 de teste';

insert into public.lesson_media (lesson_id, video_provider, video_id)
select id, 'youtube', 'dQw4w9WgXcQ' from public.lessons where title_pt = 'Aula 2 de teste'
on conflict (lesson_id) do update
  set video_provider = excluded.video_provider, video_id = excluded.video_id;
```

Não use mais `insert into public.lessons (... order_index ...)` à mão: desde
`20260804200809_harden_password_flag_and_progress` existe
`unique (module_id, order_index)`, e um `order_index` chutado colide. Quem
calcula a posição sem corrida é `create_lesson()`.

Logado como o aluno de teste (sessão real, pelo navegador ou pelo cliente
JS com a sessão dele):

```js
// tentando concluir a AULA 2 sem ter concluído a aula 1
const { error } = await supabase.rpc("complete_lesson", { p_lesson_id: "<id da aula 2>" });
console.log(error?.message);
```

**Esperado:** `error.message` = `"Conclua as aulas anteriores primeiro."` — a
linha de `lesson_progress` da aula 2 **não** é criada/atualizada.

Depois, conclua a aula 1 (`complete_lesson` com o id da aula 1 — deve
funcionar, sem erro) e repita a chamada da aula 2: agora deve retornar sem
erro e a aula 2 aparecer concluída.

**Confirme também que a gravação direta continua bloqueada** (não só a RPC):

```js
const { error } = await supabase
  .from("lesson_progress")
  .upsert({ user_id: "<id do aluno>", lesson_id: "<id da aula 2>", completed: true, percent_complete: 100 });
console.log(error?.message); // esperado: erro de RLS (violates row-level security policy)
```

## 2. Bloqueio de aula "coming_soon"

Com a aula 1 da seed no estado original (`status = 'coming_soon'`, sem linha em
`lesson_media` e portanto com `has_video = false`):

```js
const { error } = await supabase.rpc("complete_lesson", { p_lesson_id: "<id da aula 1>" });
console.log(error?.message);
```

**Esperado:** `"Esta aula ainda não pode ser concluída."` (aula não está
`published`) — se por algum motivo o status já for `published` mas sem linha em
`lesson_media`, a mensagem esperada é `"Esta aula ainda não tem vídeo
disponível."`. Nos dois casos, nenhuma linha é gravada.

## 3. Proteção das funções administrativas

Logado como o **aluno** de teste (nunca o admin):

- Abrir `/admin` no navegador — esperado: redirecionamento para `/aluno`
  (a conta é válida, só não é admin — `requireAdmin` manda pra própria área).
- Abrir `/admin/alunos`, `/admin/alunos/novo`, `/admin/cursos` diretamente
  pela URL — mesmo resultado, redireciona antes de qualquer dado
  administrativo aparecer na tela (confirme pela aba Network do navegador
  que nenhuma resposta com e-mail/lista de alunos chega a ser recebida).
- Tentar a query de negócio diretamente pela RLS, sem passar pelas Server
  Actions:
  ```js
  const { data, error } = await supabase.from("user_roles").select("*");
  console.log(data, error?.message);
  ```
  **Esperado:** só a própria linha do aluno (policy `user_roles_select_own`),
  nunca a lista inteira.
- Deslogar e tentar acessar `/admin` sem sessão nenhuma — esperado:
  redirecionamento para `/entrar?next=%2Fadmin` (o atalho do middleware).

Logado como **administrador**: repetir os mesmos acessos (`/admin`,
`/admin/alunos`, `/admin/cursos`) — esperado: acesso normal, dados
carregando.

## 4. O `video_id` não vaza para aula bloqueada

Este é o teste da migration `20260803202703_private_lesson_media.sql`. Cenário:
aluno com matrícula ativa, curso com **duas** aulas publicadas e com vídeo
cadastrado em `lesson_media`, e o aluno **sem** ter concluído a aula 1.

Logado como o aluno (sessão real):

```js
// 1. A coluna não existe mais — a query antiga falha, e é isso que se espera.
const { error } = await supabase.from("lessons").select("video_id");
console.log(error?.message); // esperado: erro de coluna inexistente

// 2. A tabela privada não é legível.
const { data, error: e2 } = await supabase.from("lesson_media").select("*");
console.log(data, e2?.message); // esperado: vazio ou erro de permissão, NUNCA linhas

// 3. A aula 2 está bloqueada: a função recusa.
const { error: e3 } = await supabase.rpc("get_lesson_playback", { p_lesson_id: "<id da aula 2>" });
console.log(e3?.message); // esperado: "Conclua as aulas anteriores primeiro."

// 4. A aula 1 está liberada: a função entrega.
const { data: d4 } = await supabase.rpc("get_lesson_playback", { p_lesson_id: "<id da aula 1>" });
console.log(d4); // esperado: [{ video_provider: "youtube", video_id: "..." }]
```

Depois conclua a aula 1 (`complete_lesson`) e repita o passo 3: agora deve
devolver o vídeo da aula 2.

**Confirme também pela rede**, não só pela API: abra `/aluno/aula/<id da aula 2>`
bloqueada no navegador e procure o ID do vídeo no HTML e nas respostas da aba
Network. Ele não pode aparecer em lugar nenhum — é o ponto todo da mudança.

```sql
-- lesson_media não pode ter policy nenhuma
select count(*) from pg_policy where polrelid = 'public.lesson_media'::regclass;
-- esperado: 0

-- e só authenticated executa a função
select grantee, privilege_type from information_schema.routine_privileges
where routine_name = 'get_lesson_playback';
-- esperado: só "authenticated" com EXECUTE
```

## 5. Conclusão pelo fim do vídeo

Com uma aula publicada, liberada e com vídeo:

- Abra a aula e **assista até o fim**. Ao terminar, a aula deve passar sozinha
  para "Aula concluída", sem nenhum clique.
- Recarregue: o estado precisa continuar concluído (veio do banco, não da tela).
- Antes do fim do vídeo **não existe botão de concluir** — confirme que não há
  nenhum na página.

Lembrete honesto: pular a timeline até o fim dispara o `ENDED` do YouTube e
conclui a aula. Isso é esperado — o bloqueio no player é proteção de
experiência, não DRM. O que não se contorna é o servidor: `complete_lesson()`
recusa aula fora de sequência, e `get_lesson_playback()` nem entrega o vídeo
da aula seguinte antes da hora.

## 6. Sanidade rápida das policies (não precisa de sessão de usuário)

Roda direto no SQL Editor, com qualquer conexão:

```sql
-- confere que RLS está ligado nas 7 tabelas
select relname, relrowsecurity
from pg_class
where relname in ('profiles','user_roles','courses','course_modules','lessons','enrollments','lesson_progress');
-- esperado: relrowsecurity = true em todas as linhas

-- confere que a gravação direta de completed=true está bloqueada pela
-- policy (não só decoração de comentário)
select polname, pg_get_expr(polwithcheck, polrelid) as with_check
from pg_policy
where polrelid = 'public.lesson_progress'::regclass
  and polname in ('lesson_progress_insert_own', 'lesson_progress_update_own');
-- esperado: a expressão contém "completed = false"

-- confere que só authenticated pode chamar complete_lesson (nunca anon)
select grantee, privilege_type
from information_schema.routine_privileges
where routine_name = 'complete_lesson';
-- esperado: só a role "authenticated" com EXECUTE
```

## 7. Verificação de integração contra o Supabase real

Rodada em 2026-08-03 contra o projeto `qlrljzodmisvohjeodxt`, com usuários
temporários criados e **removidos ao final**. 47 asserções, 0 falhas. O roteiro
executado, para quem quiser repetir:

| # | O que foi provado |
| --- | --- |
| 1 | Conta criada pelo painel recebe role `student` e **nenhuma** matrícula |
| 2 | Conta com `signup_source = 'public'` recebe 1 matrícula `source='signup'`, ativa, em `seu-livro` |
| 3 | Trigger acerta `lessons.has_video` ao cadastrar e ao remover mídia |
| 4 | Sem matrícula: RLS esconde curso e aulas; `get_lesson_playback()` recusa |
| 5 | Com matrícula: curso e as 4 aulas (published + coming_soon) aparecem |
| 6 | `lesson_media` não é legível pelo aluno; `lessons.video_id` não existe mais; aula liberada entrega o vídeo, bloqueada e "em breve" não |
| 7 | Conclusão fora de sequência recusada; gravação direta de `completed=true` bloqueada por RLS; aula publicada **sem vídeo** não conclui |
| 8 | Aluno não se promove a admin; só enxerga o próprio perfil e as próprias matrículas |
| 9 | `move_module`/`move_lesson` recusam aluno; aluno não cria curso nem apaga aula |
| 10 | Matrícula revogada: curso some, vídeo deixa de ser entregue, histórico continua visível para o aluno |
| 11 | `move_lesson` com sessão de admin troca de posição sem duplicar `order_index` e sem deixar o sentinela `-1`; devolve `false` no fim da lista |

**Fora do escopo desta rodada**: a viagem de ida e volta do e-mail de
confirmação do cadastro público. Com a confirmação ligada, `auth.signUp()`
dispara um e-mail real, e não há domínio descartável aceito pelo provedor
(`@example.com` é recusado). O que decide a matrícula gratuita é o gatilho
`handle_new_user()`, que olha `raw_user_meta_data->>'signup_source'` — e esse
ramo FOI exercitado. Falta apenas a entrega do e-mail em si: a troca do código
no `/auth/callback` passou a ser testada de verdade, ver a seção 9.

## 8. Verificação de navegador do painel e da área do aluno

**39 asserções, 0 falhas** (rodada de 2026-08-04). A suíte entra com o
**administrador real** — depois que a senha definitiva foi definida, ele entra
direto em `/admin` — e cria todo o conteúdo dentro de um **curso descartável**.
O curso real `seu-livro` e seus dados não são tocados em nenhum momento. O aluno
de QA e o curso descartável são removidos no fim, e o script imprime o que
sobrou no banco para conferência.

| Grupo | O que foi provado |
| --- | --- |
| 1 | Administrador real entra em `/admin`; dashboard carrega |
| 2 | Curso criado pelo painel nasce como **rascunho**; editor abre; estado vazio de módulos aparece |
| 3 | Dois módulos e duas aulas criados pela tela; posições numeradas pelo banco (0,1) sem colisão; aula nasce **rascunho**; ordenação pelos botões troca as aulas e **não deixa o sentinela −1**; vídeo cadastrado pela tela e `has_video` marcado pelo trigger |
| 4 | Aluno criado pelo painel: **sem matrícula automática**, com senha temporária; busca encontra; matrícula liberada fica `active` |
| 5 | Aluno com senha temporária é levado a `/redefinir-senha` e só então chega a `/aluno`; curso matriculado aparece; aula `coming_soon` **não** conta no progresso; aula liberada abre; **o `video_id` não aparece no HTML** da aula em breve; curso sem matrícula responde **404** |
| 6 | Matrícula revogada pelo painel some do painel do aluno |
| 7 | Sem sessão, `/aluno` manda para `/entrar?next=%2Faluno` |
| 8 | 5 telas do painel em **1440 / 768 / 390 px**: `h1` presente e zero overflow horizontal |
| 9 | Zero erro de console e zero resposta HTTP ≥ 400 |

Duas observações que economizam tempo de quem for repetir:

- **`innerText` devolve o texto com o `text-transform` do CSS aplicado.** Os
  títulos do painel aparecem em maiúsculas mesmo quando o dado é minúsculo.
  Compare sem caixa.
- **Não identifique formulário pelo nome do campo.** O editor de curso tem
  `titlePt` no formulário de edição *e* no de criação de módulo, e
  `querySelector` devolve o primeiro. Use o texto do botão de envio
  ("Criar módulo", "Criar aula"), que é único.
- **`move_lesson`/`move_module` não funcionam com a chave de service role**, e
  isso está certo: ali `auth.uid()` é null, então `is_admin()` é falso. A
  ordenação tem que ser exercitada com sessão de administrador — pela tela.

## 8b. Verificação de navegador das rotas públicas

**29 asserções, 0 falhas.** 18 rotas (9 pares pt/en) mais `/cadastro`,
`/entrar` e `/recuperar-senha`.

| Grupo | O que foi provado |
| --- | --- |
| 1 | Cada rota tem **exatamente um `h1`** e nenhuma imagem quebrada (`naturalWidth === 0`) |
| 2 | `canonical` + `hreflang` `pt-BR`/`en-US` em todas as páginas bilíngues |
| 3 | O seletor de idioma leva à página **equivalente**: `/termos` → `/en/terms`, `/en/privacy` → `/privacidade` |
| 4 | Home mostra **32** livros nos dois idiomas e o antigo "10+" sumiu; a página do curso **não tem preço**, anuncia o certificado, mostra as duas modalidades como "Em breve"/"Coming soon", **nenhum controle clicável de compra** e os cards das modalidades não são links nem botões |
| 5 | Termos trazem BMAXY LLC, o endereço, `contact@bmaxy.com`, a Flórida e os 7 dias de reembolso; a Privacidade cita a infraestrutura e os cookies; **nenhum EIN inventado** |
| 6 | 1440 / 768 / 390 px: nenhuma rota com overflow horizontal |
| 7 | Zero erro de console, zero resposta HTTP ≥ 400 |

Cuidado ao escrever asserção de conteúdo: procurar a palavra "checkout" no
texto marca como defeito a frase honesta *"O checkout ainda não está
disponível"*. O que se quer medir é a existência de **controle clicável** de
compra, não a ocorrência da palavra. Da mesma forma, em português o texto diz
"Flórida", com acento, e o reembolso aparece como "7 (sete) dias".

## 8c. RLS de escrita, com sessões reais

**11 asserções, 0 falhas.** Contas descartáveis (`zzrls…`) com login real pela
chave publicável — não pelo service role, porque o que se quer medir é
exatamente o que um navegador consegue fazer.

| # | O que foi provado |
| --- | --- |
| 1 | `PATCH /rest/v1/profiles` **não** zera `must_change_password` (42501), e o aluno **continua** podendo editar o próprio nome |
| 2 | Aluno não insere progresso com `completed = true`; **administrador não forja progresso de aluno**; aluno não grava na conta de outro; admin **continua lendo** progresso |
| 3 | `lesson_media` não devolve linha para o aluno; `lessons.video_id` não existe mais (42703) |
| 4 | Aluno não cria módulo por RPC; admin cria; a posição sai numerada pelo banco |

## 9. `/auth/callback` com código PKCE real

8 asserções, 0 falhas. É a rota do link de e-mail, e ela só pode ser testada de
verdade com um código PKCE legítimo — o que exige um roteiro incomum, descrito
aqui porque ninguém adivinha sozinho:

- **`generateLink` da API administrativa não serve.** Ele usa fluxo implícito e
  devolve os tokens no fragmento (`#access_token=...`), nunca `?code=`. Medido:
  o navegador cai em `/entrar?erro=link-invalido`, que é o certo para uma
  entrada sem código, mas não exercita nada.
- **O código real nasce do formulário.** Enviar `/recuperar-senha` cria a linha
  em `auth.flow_state`, e `auth_code` ali é exatamente o que o link do e-mail
  carregaria. Ler com o service key: `select user_id, auth_code from
  auth.flow_state`.
- **O cookie de `code_verifier` é de sessão.** Fechar o Chrome o descarta e a
  troca falha. O navegador precisa continuar aberto entre enviar o formulário e
  abrir `/auth/callback?code=...`.
- **Uma conta descartável por caso**, senão dois `flow_state` do mesmo usuário
  ficam ambíguos.
- **Os casos negativos pedem perfil limpo.** Com sessão ativa,
  `/entrar?erro=link-invalido` redireciona para a casa da role e a asserção
  mediria outra coisa.

| # | O que foi provado |
| --- | --- |
| 1 | Admin sem `next` é mandado para `/admin` |
| 2 | Aluno sem `next` é mandado para `/aluno` |
| 3 | Aluno pedindo `next=/admin` é mandado para `/aluno` |
| 4 | Sem `code`, volta para `/entrar?erro=link-invalido` |
| 5 | `code` inválido, o mesmo |
| 6 | Sem `code`, o `next` pedido é ignorado |
| 7 | `code` já usado não vale de novo |
| 8 | `next` externo não é seguido nem no caminho de erro |

O caso 1 é o que reproduziu o defeito original: contra o build anterior o
administrador ia mesmo parar em `/aluno`.

Fica de fora só a entrega do e-mail pela caixa postal — o provedor recusa
domínio descartável. O que o e-mail carrega é o `code`, e o `code` foi testado.

## 10. Separação administrador/aluno nas rotas reais

31 asserções, 0 falhas, no build de produção com Supabase configurado. Um admin
e um aluno descartáveis, login de verdade pelo formulário, todos removidos no
fim. É o teste que a regra pede explicitamente: **não basta testar função
pura**.

| Grupo | O que foi provado |
| --- | --- |
| 1 | `/entrar` sem `next`: admin → `/admin`, aluno → `/aluno` |
| 2 | Admin em `/aluno`, `/aluno/curso/…` e `/aluno/aula/…` → `/admin`; aluno em `/admin`, `/admin/alunos` e `/admin/cursos` → `/aluno` |
| 3 | `?next` não contorna a separação: aluno com `next=/admin` → `/aluno`; admin com `next=/aluno/curso/…` → `/admin` |
| 4 | `?next` compatível com a role é preservado |
| 5 | Redirecionamento aberto barrado: `https://…`, `//…` e `/\…` caem na casa da role |
| 6 | Senha temporária leva a `/redefinir-senha`; **navegar direto para a área não escapa da troca**; depois de trocar, cada role vai para a própria casa |
| 7 | Curso em rascunho não aparece na sessão do aluno, nem pela URL direta |
| 8 | Admin abrindo curso em rascunho por `/aluno` → `/admin`, e nenhuma tela do aluno chega a renderizar para ele |

O grupo 6 ganhou duas asserções quando `requireUser()` passou a checar
`must_change_password`. Antes a flag só valia no login: com a sessão criada,
digitar `/aluno` na barra de endereço passava direto, e a conta ficava para
sempre com a senha que o administrador conhece.
