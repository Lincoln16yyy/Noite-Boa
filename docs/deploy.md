# Deploy manual (issue #33)

Passo a passo para publicar o sistema completo com custo R$ 0. Cada passo **depende de
você** (contas, segredos e cliques no dashboard); este documento é a fonte da verdade
de como fazer. Valores entre `<chaves>` são placeholders — substitua pelos seus.

> Arquitetura final: **Vercel** (React) → **Render** (API Spring Boot, Docker) →
> **Neon** (PostgreSQL). Ver `docs/ADR-0002-hospedagem.md` para o porquê.

## Pré-requisitos

- Conta no [Render](https://dashboard.render.com/register) (sem cartão de crédito).
- Projeto já criado no Neon com a string de conexão em mãos
  (Console Neon → **Connect** → **Direct** e **Pooled**; usaremos a direct).
- Projeto já publicado na Vercel (feito).

## Passo 1 — Subir o back-end pela Blueprint (render.yaml)

1. No dashboard da Render: **New → Blueprint**.
2. Conecte o repositório `Lincoln16yyy/Noite-Boa` (branch `main`).
3. A Render lê o `render.yaml` da raiz e propõe o serviço `noiteboa-api`
   (Docker, `backend/Dockerfile`, health check `/actuator/health`).
4. **Região:** escolha a mesma região do seu projeto Neon (ex.: Neon em Ohio →
   Render `ohio`). Se o padrão (`oregon`) já coincidir, mantenha.
5. Na criação, a Render pede os valores das variáveis com `sync: false` (Passo 2).

## Passo 2 — Variáveis de ambiente do serviço `noiteboa-api`

| Variável | Valor | De onde vem |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` | já vem fixa do `render.yaml` |
| `DB_POOL_SIZE` | `5` | já vem fixa do `render.yaml` |
| `JWT_SECRET` | gere um: `openssl rand -base64 48` | você gera; guarde no gerenciador de senhas |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<host-do-neon>/<banco>?sslmode=require` | Neon → Connect (veja formato abaixo) |
| `SPRING_DATASOURCE_USERNAME` | usuário do Neon | Neon → Connect |
| `SPRING_DATASOURCE_PASSWORD` | senha do Neon | Neon → Connect |
| `CORS_ALLOWED_ORIGINS` | `https://<app-do-front>.vercel.app` | domínio(s) do front na Vercel, separados por vírgula |

> O nome legado `CORS_ALLOWED_ORIGIN` (singular) também é aceito pelo back-end
> como fallback, mas o nome canônico é o plural `CORS_ALLOWED_ORIGINS` (issue #192).

**Formato do `SPRING_DATASOURCE_URL`:** o Neon entrega algo como
`postgres://usuario:senha@ep-exemplo-abc123.aws.neon.tech/neondb?sslmode=require`.
Transforme em:

```
jdbc:postgresql://ep-exemplo-abc123.aws.neon.tech/neondb?sslmode=require
```

- troque `postgres://` por `jdbc:postgresql://`;
- **remova** `usuario:senha` da URL (eles vão em `SPRING_DATASOURCE_USERNAME`/`PASSWORD`);
- mantenha `sslmode=require` (o Neon exige SSL).

> **Se a Render falhar no boot** com `IllegalStateException: JWT_SECRET não
> configurada (perfil prod)...` (o log mostra `Application run failed` com essa
> causa): a variável `JWT_SECRET` não foi definida, está vazia ou é igual ao
> valor de desenvolvimento. Defina-a no dashboard e faça redeploy. A proteção
> vive no `JwtService` e é ligada por `JWT_SECRET_REQUIRED: true` no
> `application-prod.yml` — **não** remova essa linha para "consertar": liberaria
> o segredo de desenvolvimento em produção.

## Passo 3 — Apontar o front-end para a API (Vercel)

1. Vercel → seu projeto → **Settings → Environment Variables**.
2. Crie `VITE_API_URL` = `https://<servico-da-api>.onrender.com/api`
   (o nome do serviço + `.onrender.com` aparece na página do serviço na Render).
   Marque os ambientes **Production** *e* **Preview** — o link de cada PR é um
   ambiente Preview e, sem a variável nele, o app chama `localhost:8080` e o
   navegador acusa `NetworkError when attempting to fetch resource`.
3. Faça um **redeploy** do front-end (o Vite embute a URL no build — mudar a
   variável sozinho não reaplica em deploy antigo).

## Passo 3.5 — Liberar os domínios no CORS (Render)

O back-end só aceita origens listadas em `CORS_ALLOWED_ORIGINS` (ou a legada
`CORS_ALLOWED_ORIGIN`). Como cada branch de PR ganha um domínio novo
(`https://noite-boa-git-<branch>-<time>.vercel.app`), a variável aceita
**padrões** desde a issue #233:

1. Render → serviço da API → **Environment** → `CORS_ALLOWED_ORIGINS`
   (plural!) com, por exemplo:
   ```
   https://*.vercel.app,http://localhost:5173
   ```
   O padrão cobre produção e todos os previews de PR. Origens exatas também
   podem entrar na lista, separadas por vírgula.
2. **Redeploy** do back-end (env nova exige restart).
3. Confirmação rápida do preflight:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
     https://<servico-da-api>.onrender.com/api/me \
     -H "Origin: https://<dominio-do-front>" \
     -H "Access-Control-Request-Method: GET"
   # esperado: 200 (403 = origem fora da lista)
   ```

## Passo 4 — Validação obrigatória (antes de considerar o deploy concluído)

Rode nesta ordem e **não pule nenhuma**:

1. **Health check:**
   ```bash
   curl -s https://<servico-da-api>.onrender.com/actuator/health
   # esperado: {"status":"UP"}
   ```
   (primeira chamada pode levar ~1 minuto — a instância free acorda.)
2. **Flyway:** nos logs do serviço, confira as linhas de migração no boot; e no
   Neon (SQL Editor):
   ```sql
   SELECT installed_rank, version, description, success
   FROM flyway_schema_history ORDER BY installed_rank;
   ```
   esperado: versões `1` a `4`, todas com `success = true`.
3. **Sem segredos nos logs:** procure nos logs se `JWT_SECRET`/senha aparecem
   (não devem).
4. **Cadastro + login pela API:**
   ```bash
   curl -s -X POST https://<servico-da-api>.onrender.com/api/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"email":"deploy-teste@example.com","password":"<senha-de-teste>","displayName":"Deploy"}'
   ```
5. **Front-end ponta a ponta:** acesse o app na Vercel, cadastre-se, faça login,
   registre uma noite de sono e recarregue — os dados precisam persistir (prova
   de que front → API → Neon funciona).
6. **CORS:** na aba Network do navegador, a chamada para `/api/...` deve ter
   status 200 (sem erro de origem) e o header `access-control-allow-origin`
   correspondente a `CORS_ALLOWED_ORIGINS`.

## Deploy contínuo (GitHub Actions → Render — issue #83)

Fluxo automático a cada push em `main`:

1. **CI** (`.github/workflows/ci.yml`) roda backend + frontend.
2. Se o CI terminar **verde**, o workflow **Deploy** (`.github/workflows/deploy.yml`,
   gatilho `workflow_run`) chama a API da Render com o `commitId` do push
   (`POST /services/{id}/deploys`). O `render.yaml` usa `autoDeployTrigger: off`,
   ou seja, **este workflow é o único que dispara deploy**.
   *Antes de disparar, ele confirma que o commit ainda é o HEAD da `main`: com
   execuções concorrentes, um commit antigo nunca republica por cima de um mais
   novo; se a consulta à API do GitHub falhar, não implanta.*
3. Ele espera o status **`live`** (até 25 min; `build_failed`/`canceled` → job vermelho).
4. **Smoke test** de produção — qualquer item vermelho falha o job:
   - `GET /actuator/health` → 200 e `"status":"UP"` (retenta até 5 min);
   - preflight CORS com `Origin` do front → `access-control-allow-origin` exato;
   - front `/`, `/cadastro`, `/login`, `/dashboard` → 200 (guarda do rewrite SPA);
   - bundle `/assets/index-*.js` contém `noiteboa-api.onrender.com/api`
     (guarda da `VITE_API_URL`).

Falha nos smoke = **versão nova já publicada e não validada** — não há rollback
automático (rollback manual: Render Dashboard → `noiteboa-api` → Deploys → Rollback).
O step final do workflow deixa isso explícito no log quando o job fica vermelho.

Também pode disparar manualmente: **Actions → Deploy (GitHub Actions → Render) → Run workflow**.

### Segredo obrigatório

| Segredo (GitHub Actions) | Onde criar o valor |
|---|---|
| `RENDER_API_KEY` | Render Dashboard → avatar → **Account Settings → API Keys** → *Create API key* (a chave é mostrada **uma única vez**; nomeie `gh-actions-deploy`) |

Set pelo painel do GitHub (**Settings → Secrets and variables → Actions → New repository secret**)
ou no terminal (o valor não vai para o histórico nem para o chat):

```bash
gh secret set RENDER_API_KEY   # cole a chave quando pedir e finalize com Ctrl+D
```

Sem o secret, o job falha no primeiro passo com a instrução no log. Nunca versione a chave (AGENTS.md).

Por que não um smoke test no mesmo commit da CI: a Render com `checksPass` espera
**todos** os checks do commit (docs oficiais: `render.com/docs/deploys`) — o smoke
rodaria antes do deploy novo (validando a instância antiga) ou, se a produção
estivesse fora, **bloquearia o próprio deploy** que consertaria o problema.

## Limites conhecidos do plano free

- Render: serviço dorme após 15 min sem tráfego (cold start ~1 min);
  750 horas de instância/mês por workspace.
- Neon: scale-to-zero após 5 min; 0,5 GB de storage e 100 CU-horas/mês por projeto.
- Filesystem da Render é efêmero (tudo que importa está no Neon).

## Checklist para fechar a issue #33

- [x] ADR escrita (`docs/ADR-0002-hospedagem.md`) — neste PR.
- [ ] Blueprint sincronizada e serviço `noiteboa-api` na Render em estado **Live**.
- [ ] Variáveis de ambiente preenchidas (Passo 2) — feito por humano.
- [ ] `GET /actuator/health` respondendo `{"status":"UP"}` no endereço público.
- [ ] Flyway com V1..V5 `success = true` no banco do Neon.
- [ ] Fluxo completo (cadastro → login → registro de sono) funcionando no front publicado.
- [x] Workflow de deploy contínuo — issue #83 (`deploy.yml` + seção "Deploy contínuo").
