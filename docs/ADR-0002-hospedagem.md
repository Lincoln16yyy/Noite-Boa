# ADR-0002: Hospedagem e deploy (custo inicial R$ 0)

- **Status:** aceita (revisável)
- **Data:** 2026-10-09
- **Issue:** #33

## Contexto

O MVP precisa ficar público com **custo inicial de R$ 0/mês**: back-end Java/Spring
Boot, PostgreSQL e front-end React. O front-end já está publicado na Vercel e o banco
já foi criado no Neon (planos gratuitos); falta publicar o back-end e amarrar as peças
com variáveis de ambiente. Planos gratuitos mudam com frequência — os números abaixo
foram consultados nas páginas oficiais em **09/10/2026** e servem para a decisão da
época, não como contrato.

## Decisão

- **Back-end:** Render — web service em plano `free` buildado do `backend/Dockerfile`
  (multi-stage Maven → JRE 21), health check em `/actuator/health`, deploy automático
  só quando a CI do GitHub passar (`autoDeployTrigger: checksPass`). A configuração
  inteira vive no `render.yaml` na raiz do repositório.
- **Banco:** Neon free (já provisionado) — PostgreSQL serverless acessado por
  `SPRING_DATASOURCE_URL=jdbc:postgresql://<host>/<banco>?sslmode=require` +
  usuário/senha via `SPRING_DATASOURCE_USERNAME`/`SPRING_DATASOURCE_PASSWORD`.
  Nenhuma credencial no código ou no Git.
- **Front-end:** Vercel (já publicado) — variável de build `VITE_API_URL` apontando
  para a API na Render (o Vite embute a URL no build; não há como trocar em runtime).

## Alternativas consideradas

### Back-end

| Opção | Análise |
|---|---|
| **Render (escolhida)** | Web service `free` real (512 MB / 0.1 CPU), Docker nativo, health check, blueprints (`render.yaml`), sem cartão de crédito. 750 horas de instância/mês por workspace. |
| Railway | Cobrança por uso com crédito de trial; **não há plano free permanente** — quebraria a regra de custo zero. |
| VPS auto-hospedado (Oracle Cloud / AWS Free Tier) | Custo zero possível, mas exige sysadmin (SSH, TLS, systemd, backups) e cartão; risco e tempo desnecessários para o MVP. |

### Banco

| Opção | Análise |
|---|---|
| **Neon (escolhido, já provisionado)** | Free sem prazo de validade: scale-to-zero após 5 min de inatividade, 0,5 GB de storage e 100 CU-horas/mês por projeto, 10 branches. HTTPS/SSL obrigatório (`sslmode=require`). |
| Supabase | Free entrega auth/storage que **não usamos** (temos auth própria com JWT), limita a ~2 projetos ativos e pausa projetos inativos. |
| Render Postgres (free) | 1 GB, mas **expira em 30 dias** (+14 dias de carência) segundo a documentação da Render de 2026 — e amarra o dado à mesma plataforma do back-end. |

### Front-end

| Opção | Análise |
|---|---|
| **Vercel (escolhido, já publicado)** | Hobby R$ 0, deploy automático em PR, integração já configurada com preview. |
| Netlify / Cloudflare Pages | Equivalentes; migrar hoje não traz ganho e só gera retrabalho. |

## Consequências

- **Free na Render dorme:** 15 min sem tráfego → desliga; a próxima requisição leva
  ~1 minuto para subir (cold start). Aceitável para MVP; o plano pago remove isso.
- **750 horas de instância/mês** por workspace; serviço parado não consome horas —
  se esgotarem, os serviços free ficam suspensos até o mês seguinte.
- **Neon scale-to-zero:** primeira consulta após inatividade paga alguns centenas de
  ms; o pool Hikari (`DB_POOL_SIZE`, padrão 5) mantém conexões quentes entre requisições.
- **Filesystem efêmero** na Render: nada é gravado no disco do serviço — todo
  persistência (Flyway + dados) vive no Neon.
- **CORS multi-origem** (`SecurityConfig` lê `cors.allowed-origins`, env
  `CORS_ALLOWED_ORIGINS`, com origens separadas por vírgula; normaliza espaços e
  barra final). O nome legado singular `CORS_ALLOWED_ORIGIN` também é aceito como
  fallback (issue #192), então uma variável antiga no dashboard não derruba o front.
- **Migrações na subida do serviço:** `spring.flyway.enabled=true` aplica V1..V5
  automaticamente no boot (migrações aditivas — `CREATE`, `ALTER ADD COLUMN`,
  `ADD CONSTRAINT` — nada destrutivo; a V5 instala a extensão `btree_gist` em
  `public` e recusa noites sobrepostas, então a role do deploy precisa poder
  criar extensão no schema). Se a extensão já existir em **outro** schema, a V5
  a relocaliza para `public` (`ALTER EXTENSION ... SET SCHEMA public`), o que
  exige que a role do deploy **seja dona** da extensão (ou superuser) — só
  `CREATE` no schema não basta.
  Com 1 instância free não há corrida entre instâncias; se um dia houver múltiplas,
  mover migração para `preDeployCommand`.
- **`JWT_SECRET` obrigatória no perfil `prod`:** sem a variável, o startup falha
  (`application-prod.yml`) em vez de assinar tokens com o segredo de desenvolvimento.
- **Workflow de deploy contínuo (issue #83):** `autoDeployTrigger: off` no
  `render.yaml` — o workflow `deploy.yml` (GitHub Actions) dispara o deploy via
  API da Render após o CI verde (gatilho `workflow_run`), espera o status `live`
  e roda smoke test (health, CORS, rotas do SPA e bundle). Motivo da troca em
  relação a `checksPass`: a Render espera **todos** os checks do commit
  (docs oficiais: `render.com/docs/deploys`), então um smoke no mesmo commit
  validaria a instância antiga ou — se a produção estivesse fora — bloquearia o
  deploy que consertaria o problema. Antes de disparar, o workflow confirma que o
  commit ainda é o HEAD da `main` (proteção contra republicação fora de ordem em
  execuções concorrentes — a fila de `concurrency` não basta). Segredo único:
  `RENDER_API_KEY` (GitHub Secrets; passo a passo em `docs/deploy.md`).

## Referências consultadas (09/10/2026)

- Render: `render.com/docs/free`, `render.com/docs/blueprint-spec`, `render.com/pricing`
- Neon: `neon.com/faqs/free-plan-limits-and-quotas`, `neon.com/docs/introduction/plans`
