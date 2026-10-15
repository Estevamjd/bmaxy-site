# Backup e restauração

**Nada aqui foi executado.** Nenhum `pg_dump` foi rodado, nenhum arquivo de
backup foi gerado, nenhuma restauração foi testada — nem no projeto principal,
nem num projeto separado. É o procedimento a seguir; a primeira execução
depende de acesso ao banco de produção e é responsabilidade de quem tem esse
acesso.

**Enquanto isso não acontecer, o projeto está sem backup.**

---

## RPO e RTO

| | Alvo | Por quê |
| --- | --- | --- |
| **RPO** (quanto se aceita perder) | **24 h** hoje · **1 h** depois das primeiras matrículas | Hoje o banco tem 1 administrador, 1 curso e 0 matrículas. Perder 24 h de escrita significa perder quase nada. Isso muda no dia em que houver aluno pagando. |
| **RTO** (quanto se aceita ficar fora) | **4 h** | Restaurar um dump lógico deste tamanho leva minutos; o tempo é dominado por perceber o problema, decidir restaurar e reapontar a aplicação. |

### O dado mais caro não é o que parece

Não é o curso — o conteúdo está no repositório e no seed, e se recria. É
`lesson_progress`: o registro de que uma pessoa assistiu às aulas. Não se
reconstrói de lugar nenhum, e perdê-lo significa mandar o aluno refazer o que
já fez. Junto com `enrollments` (quem tem direito de acesso), é o que justifica
todo este documento.

Enquanto essas duas tabelas estiverem vazias, o risco real é baixo. Reveja o
RPO no dia da primeira matrícula.

---

## O que o Supabase faz — e o que ele NÃO faz no plano Free

> ### ⚠️ Correção de uma versão anterior deste documento
>
> Este arquivo já afirmou que "o plano gratuito faz backup automático diário".
> **Isso estava errado**, e errado do jeito mais perigoso: dava a entender que
> existia uma rede de segurança onde não existe.
>
> **No plano Free do Supabase não há backup automático gerenciado.** Os
> backups diários com restauração pelo painel são recurso de plano pago
> (Pro em diante), e mesmo lá a retenção é curta e a restauração é para o
> **mesmo projeto**.

A consequência prática, hoje, com o projeto no Free:

**O dump lógico descrito abaixo não é "uma camada extra". É a ÚNICA cópia que
existe.** Enquanto ele não for executado e guardado fora do Supabase, o banco
não tem backup nenhum — nem contra exclusão acidental, nem contra perda de
acesso à conta, nem contra erro humano.

Mesmo depois de contratar um plano pago, o dump externo continua necessário,
porque backup gerenciado não cobre:

- **perda de acesso à conta** — se a conta Supabase for suspensa ou invadida, o
  backup está do lado de dentro do problema;
- **exclusão acidental do projeto** — vai junto;
- **erro humano descoberto tarde**, quando a retenção já passou;
- **portabilidade** — sem dump lógico, migrar de provedor exige o provedor
  cooperando.

Backup no mesmo lugar do dado é conveniência, não backup. **Confirme no painel
o que o plano contratado de fato oferece** antes de confiar em qualquer número
— a Supabase mudou essa política mais de uma vez, e foi assim que a afirmação
errada entrou aqui.

---

## Backup lógico criptografado

### Comando

```bash
# 1. Dump. A senha NUNCA vai na linha de comando (ver o aviso abaixo).
export PGPASSWORD="$(read -rs -p 'senha do banco: ' s && echo "$s")"

pg_dump \
  --host=db.<PROJECT_REF>.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --format=custom \
  --no-owner --no-privileges \
  --file="bmaxy-$(date -u +%Y%m%dT%H%M%SZ).dump"

unset PGPASSWORD

# 2. Criptografar. Sem isto o arquivo é um vazamento esperando destino:
#    contém e-mails, hashes de senha e todo o auth.users.
gpg --symmetric --cipher-algo AES256 \
    --output "bmaxy-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg" \
    "bmaxy-....dump"

# 3. Apagar o dump em claro.
shred -u bmaxy-*.dump   # ou `rm -P` no macOS
```

### Três avisos que valem mais que o comando

1. **A senha do banco não pode ir para o repositório nem para o histórico do
   shell.** `PGPASSWORD=abc pg_dump ...` fica no `~/.bash_history` e em
   `ps aux` enquanto roda. Use `~/.pgpass` (modo `600`) ou leitura interativa.
2. **A senha do GPG é tão crítica quanto o dump.** Guardada junto com o
   arquivo, a criptografia é decorativa. Cofre de senhas, separado do
   armazenamento.
3. **`--format=custom`**, não SQL puro: permite restauração seletiva de tabela
   com `pg_restore` e comprime.

### Onde guardar

**Fora do Supabase e fora da Vercel.** Um provedor de objeto (Backblaze B2, S3,
Cloudflare R2) com versionamento e credencial dedicada de escrita — não a
credencial administrativa da conta.

Frequência: diária enquanto o RPO for 24 h. Reter 30 dias diários e 6 mensais.

---

## Teste de restauração

> ### ⛔ NUNCA restaure no projeto de produção
>
> Restaurar sobre o banco vivo é o caminho mais rápido para transformar um
> susto em perda real. O teste **sempre** roda num projeto Supabase separado,
> criado para isso e apagado depois.

### Passo a passo

1. **Criar um projeto novo** no Supabase — nome tipo `bmaxy-restore-teste`.
   Região igual à de produção, para o tempo medido ser comparável.
2. **Descriptografar** o dump mais recente:
   ```bash
   gpg --decrypt bmaxy-<data>.dump.gpg > restore.dump
   ```
3. **Restaurar** apontando para o projeto de TESTE. Confira o host duas vezes
   antes de apertar enter — é aqui que o acidente acontece:
   ```bash
   pg_restore \
     --host=db.<REF_DO_PROJETO_DE_TESTE>.supabase.co \
     --port=5432 --username=postgres --dbname=postgres \
     --no-owner --no-privileges --clean --if-exists \
     restore.dump
   ```
4. **Conferir** que o dado voltou inteiro:
   ```sql
   select
     (select count(*) from auth.users)            as usuarios,
     (select count(*) from public.courses)        as cursos,
     (select count(*) from public.enrollments)    as matriculas,
     (select count(*) from public.lesson_progress) as progresso,
     (select count(*) from public.lesson_media)   as midias;
   ```
   Compare com produção. Confira também que a RLS voltou ligada:
   ```sql
   select relname, relrowsecurity from pg_class
   where relname in ('profiles','user_roles','courses','course_modules',
                     'lessons','enrollments','lesson_progress','lesson_media');
   ```
5. **Anotar o tempo** do passo 3 ao 4. É o RTO real, e provavelmente não é o
   estimado.
6. **Apagar o projeto de teste** e o `restore.dump` em claro.

### Com que frequência

Trimestral, e sempre depois de uma migration que mude estrutura. Um backup
nunca restaurado é uma hipótese, não um backup.

### O que o dump lógico NÃO leva

- **Configuração do Auth** (provedores, templates de e-mail, rate limits, URLs
  de callback) — vive no projeto, não no banco. Anote à parte.
- **Variáveis de ambiente** da Vercel.
- **Storage**, se um dia for usado.

Restaurar o banco num projeto novo devolve os dados, não o projeto
funcionando. Essa diferença é o que separa o RTO estimado do real.
