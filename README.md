# Noite Boa

App web para **registrar o sono, entender o padrão e criar consistência de horários**. Projeto autoral de Lincoln, inspirado na ideia do projeto integrador "Meu Soninho" (IFPI Picos), com código, nome e identidade próprios.

- Plano completo (escopo, arquitetura, modelo de dados, API): [`PLANO.md`](PLANO.md)
- Como agentes de IA devem trabalhar: [`AGENTS.md`](AGENTS.md)
- Como contribuir (issues, branches, PRs): [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Decisões técnicas (ADRs) e identidade: [`docs/`](docs/)

**Stack:** Java 21 + Spring Boot 3 + PostgreSQL (back-end) · React + Vite + TypeScript (front-end) · GitHub Actions (CI) · Render + Neon + Vercel (produção, planos free).

## Pré-requisitos

| Ferramenta | Versão usada | Como conferir |
|---|---|---|
| Docker + Docker Compose | 24+ | `docker --version` |
| JDK | 21 | `java --version` |
| Maven | 3.9+ | `mvn --version` |
| Node.js | 24 | `node --version` |
| npm | 11+ (acompanha o Node) | `npm --version` |
| Git | 2.x | `git --version` |
| GitHub CLI (`gh`) | opcional (issues e PRs) | `gh --version` |

Sem Docker também funciona: use um PostgreSQL 16 em `localhost:5432` e aponte as variáveis de ambiente abaixo para ele.

## Rodando localmente (do zero)

### 1. Banco de dados (PostgreSQL 16 via Docker)

```bash
cp .env.example .env   # referência das variáveis (sem segredos reais)
docker compose up -d   # sobe o PostgreSQL
```

O `docker-compose.yml` já traz os valores de desenvolvimento: **`localhost:5432`** · usuário `sono` · banco `sono` · senha `sono_dev_only`.

```bash
docker compose ps      # ver status
docker compose logs db # ver logs
docker compose down    # derrubar
docker compose down -v # derrubar e apagar os dados (reset)
```

### 2. Back-end (http://localhost:8080)

```bash
cd backend
mvn spring-boot:run                              # API em http://localhost:8080
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run   # idem, com o Swagger habilitado
```

```bash
mvn -B verify    # compila e roda todos os testes (também é o que a CI faz)
```

> **Banco dos testes:** a suíte sobe um **PostgreSQL 16 efêmero** via
> Testcontainers e o descarta no fim — não usa o banco de desenvolvimento nem
> exige `POSTGRES_DB`. O único pré-requisito é o Docker (o mesmo do
> `docker compose`), que já é necessário para rodar o projeto.

Conferindo que subiu:

```bash
curl http://localhost:8080/actuator/health   # {"status":"UP"}
```

### 3. Front-end (http://localhost:5173)

```bash
cd frontend
npm ci            # instala as dependências (uma vez)
npm run dev       # sobe em http://localhost:5173 (precisa da API em :8080)
```

Abra http://localhost:5173, crie uma conta e registre uma noite.

Verificações e build:

```bash
npm run typecheck # checagem de tipos (tsc --noEmit)
npm run lint # lint (oxlint)
npm test # testes (vitest)
npm run build # typecheck + build de produção em frontend/dist
```

### O que a CI roda

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa, em cada PR: `mvn -B verify` (os testes sobem o PostgreSQL 16 efêmero via Testcontainers), `npm ci && npm run typecheck && npm run lint && npm test && npm run build` e um **teste de fumaça E2E** no navegador ([`tools/e2e`](tools/e2e)). **Só faça o merge com tudo verde.**

### Teste de fumaça E2E

Sobe o app compilado com a API simulada e cobre os fluxos que já quebraram sem os testes unitários pegarem (login, sessão, registrar noite, sair e modo escuro legível):

```bash
cd frontend && npm ci && npm run build
cd ../tools/e2e && npm ci && npm run smoke
```

Detalhes em [`tools/e2e/README.md`](tools/e2e/README.md).

### Prints, mockups e o quadro da marca

Os mockups em [`docs/design/mockups/`](docs/design/mockups/) são o **alvo** visual; os prints são o app renderizado de verdade. Para fotografar as telas, comparar com o alvo e regenerar o quadro da marca:

```bash
cd frontend && npm ci && npm run build && npx vite preview --port 4173 &

cd tools/visual && npm ci
node screenshots.mjs                 # prints: celular 390 px e desktop 1280 px
node compare.mjs hoje                # hoje.png (mockup) ao lado do print de hoje
node brand-board.mjs                 # regenera docs/brand-board.png com telas reais
```

- A saída fica em `tools/visual/out/` (não versionada): `mobile-<tela>` / `desktop-<tela>` por tela e `compare-<tela>.png` com o mockup à esquerda e o app à direita.
- Variáveis: `ONLY=hoje,dashboard` limita as telas, `THEME=dark|light` escolhe o tema, `ESTADO=vazio|carregando|erro` simula estados, `WIDTHS=768,1280` troca as larguras e `MODO=tela` fotografa com a barra inferior fixa no pé da imagem (padrão: `pagina`, a página inteira).
- Os números dos mockups são fictícios; os prints usam a API simulada de [`tools/visual/mocks.mjs`](tools/visual/mocks.mjs).
- O que cada tela deve mostrar está em [`docs/design/direcao-visual.md`](docs/design/direcao-visual.md); a marca, em [`docs/identidade-visual.md`](docs/identidade-visual.md). Para rodar tudo e conferir o visual, use a skill `.claude/skills/verificar-visual/SKILL.md`.

## API

**Base:** `http://localhost:8080/api`

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST | `/auth/register` | Cria a conta (201) | — |
| POST | `/auth/login` | Devolve o token JWT (200) | — |
| GET | `/me` | Perfil e fuso horário | Bearer |
| PUT | `/me` | Atualiza o fuso horário e o compartilhamento com amigos (`shareWithFriends`) | Bearer |
| DELETE | `/me` | Exclui a conta e todos os dados | Bearer |
| POST | `/sleep-logs` | Registra uma noite (201) | Bearer |
| GET | `/sleep-logs` | Lista: filtros `from`/`to`, paginação `page`/`size` (máx. 100), ordem do mais recente | Bearer |
| PUT | `/sleep-logs/{id}` | Edita uma noite | Bearer |
| DELETE | `/sleep-logs/{id}` | Exclui uma noite | Bearer |
| GET | `/goal` | Meta de sono (cria a padrão se não existir) | Bearer |
| PUT | `/goal` | Atualiza a meta (240–720 min + horários) | Bearer |
| GET | `/stats/summary?days=7\|30` | Média, constância, dívida de sono, série diária e média do período anterior (`previousAverageHours`, anulável) | Bearer |

- **Autenticação:** header `Authorization: Bearer <token>`. O front-end guarda o token no `localStorage` e o envia automaticamente; sem token (ou com ele expirado), as rotas protegidas respondem **401**.
- **Erros:** no formato `ProblemDetail` (RFC 9457), com `status`, `title` e `detail` — ex.: `{"status":409,"detail":"E-mail já cadastrado"}`.
- **Cada usuário vê só os próprios dados**: todas as rotas de dados filtram pelo usuário autenticado.

### Swagger / OpenAPI

O Swagger fica desligado por padrão e é habilitado pelo profile `dev`:

```bash
cd backend
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run
```

- **Swagger UI:** http://localhost:8080/swagger-ui.html
- **Documento OpenAPI (JSON):** http://localhost:8080/v3/api-docs

> Os endpoints de exemplo do Swagger usam o servidor local; para testar, primeiro faça `POST /api/auth/login` e copie o token no botão **Authorize**.

## Variáveis de ambiente

### Back-end

| Variável | Padrão (dev) | Observação |
|---|---|---|
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | Host e porta do PostgreSQL |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `sono` / `sono` / `sono_dev_only` | Credenciais; **troque em produção** |
| `JWT_SECRET` | valor só de dev | **Obrigatório em produção** (assina os tokens) |
| `JWT_EXPIRATION_SECONDS` | `3600` | Validade do token em segundos |
| `RATELIMIT_LOGIN_LIMITE` / `RATELIMIT_LOGIN_JANELA` | `5` / `60` | Tentativas de login por minuto por IP + e-mail; estouro responde **429** com `Retry-After` |
| `RATELIMIT_LOGIN_EMAIL_LIMITE` / `RATELIMIT_LOGIN_EMAIL_JANELA` | `20` / `3600` | Teto de tentativas de login por e-mail, **independente do IP** (fecha o furo de forjar o IP); estouro responde **429** |
| `RATELIMIT_CADASTRO_LIMITE` / `RATELIMIT_CADASTRO_JANELA` | `5` / `3600` | Cadastros por hora por IP; estouro responde **429** com `Retry-After` |
| `FORWARD_HEADERS_STRATEGY` | `framework` | Obtém o IP real do cliente atrás do proxy da Render (base do limite acima) |
| `SPRING_PROFILES_ACTIVE` | — | `dev` habilita o Swagger |
| `DB_POOL_SIZE` | `5` | Tamanho máximo do pool do Hikari (Render free / Neon free) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Origens do front-end, separadas por vírgula; aceita padrões (ex.: `https://*.vercel.app`). O nome legado `CORS_ALLOWED_ORIGIN` (singular) também funciona |
| `PORT` | `8080` | Porta HTTP; a Render injeta a dela (10000) |

Os padrões estão em `backend/src/main/resources/application.yml` e a referência versionada está no [`.env.example`](.env.example).

**Produção (Render + Neon):** o `application.yml` lê `DB_HOST`/`DB_PORT`/`POSTGRES_*` para o
banco local, mas em produção o Spring Boot aceita as variáveis padrão do Neon, que têm
precedência: `SPRING_DATASOURCE_URL` (`jdbc:postgresql://<host>/<banco>?sslmode=require`),
`SPRING_DATASOURCE_USERNAME` e `SPRING_DATASOURCE_PASSWORD`. Elas ficam no dashboard da
Render (`sync: false`), nunca no Git.

### Front-end

| Variável | Padrão | Observação |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080/api` | Usada **no momento do build** (o Vite embute o valor no JavaScript) |

## Build de imagens (Docker)

Os Dockerfiles são multi-stage: dependências/build em uma etapa e imagem final enxuta em outra.

```bash
# back-end: Maven (JDK 21) -> JRE 21
docker build -t noiteboa-backend ./backend

# front-end: Node 24 -> Nginx não-root (serve o SPA na 8080)
docker build -t noiteboa-frontend ./frontend

# a URL da API é embutida no build do front-end:
docker build -t noiteboa-frontend \
  --build-arg VITE_API_URL=https://api.seudominio.com/api ./frontend
```

Rodar o back-end com variáveis de ambiente (exemplo apontando para o Postgres do `docker compose`):

```bash
docker run --rm -p 8080:8080 \
  --add-host host.docker.internal:host-gateway \
  -e DB_HOST=host.docker.internal -e DB_PORT=5432 \
  -e POSTGRES_DB=sono -e POSTGRES_USER=sono -e POSTGRES_PASSWORD=sono_dev_only \
  -e JWT_SECRET=troque-este-valor-em-producao \
  -e JWT_EXPIRATION_SECONDS=3600 \
  noiteboa-backend
```

Rodar o front-end:

```bash
docker run --rm -p 8081:8080 noiteboa-frontend   # http://localhost:8081
```

A imagem roda o Nginx como usuário `nginx` (não-root); por isso o container serve internamente na **8080** e qualquer porta externa deve ser mapeada para ela (portas abaixo de 1024 exigiriam root).

## Estrutura

```
backend/    Java 21 + Spring Boot 3 + PostgreSQL (API REST, Flyway)
frontend/   React + Vite + TypeScript (PWA)
tools/      E2E (Puppeteer), prints/mockups e utilitários de build
docs/       ADRs, identidade visual, deploy e documentação
.claude/    Skills dos agentes de IA
.github/    Workflows, templates e issues seed
scripts/    Setup do repositório
```

A hospedagem de produção está no [`render.yaml`](render.yaml) (API na Render) e no
[`docs/deploy.md`](docs/deploy.md); o front-end fica na Vercel e o banco no Neon.

## Como contribuir

O fluxo completo — issues por label, nome de branch, estilo de commit, verificações e regras de PR — está em [`CONTRIBUTING.md`](CONTRIBUTING.md). Resumo em um comando:

```bash
git checkout main && git pull && git checkout -b feat/34-slug-da-issue
```

Regras de ouro: **uma issue por vez**, `Closes #NUMERO` no PR, CI verde antes do merge e quem revisa faz o merge.

## O que cada label significa

| Label | Uso |
|---|---|
| `agente:ok` | Agente de IA pode executar sozinho |
| `agente:revisar` | Agente pode fazer, mas você revisa com atenção (segurança/dados) |
| `agente:humano` | Só você (configurações, segredos, decisões) |
| `tipo:*`, `area:*`, `prio:*` | Organização |
| `mvp` / `pos-mvp` | Fase |

## Setup inicial do repositório

Registro histórico de como o repositório foi preparado (labels, milestones, issues seed, `@claude` e quadro opcional): [`docs/setup-repositorio.md`](docs/setup-repositorio.md).

## Licença
MIT. Veja [`LICENSE`](LICENSE).
