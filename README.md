# Noite Boa

App web para **registrar o sono, entender o padrão e criar consistência de horários**. Projeto autoral de Lincoln, inspirado na ideia do projeto integrador "Meu Soninho" (IFPI Picos), com código, nome e identidade próprios.

- Plano completo (escopo, arquitetura, modelo de dados, API): [`PLANO.md`](PLANO.md)
- Como agentes de IA devem trabalhar: [`AGENTS.md`](AGENTS.md)
- Como contribuir (issues, branches, PRs): [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Decisões técnicas (ADRs) e identidade: [`docs/`](docs/)

**Stack:** Java 21 + Spring Boot 3 + PostgreSQL (back-end) · React + Vite (front-end) · GitHub Actions (CI).

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

> **Dados de desenvolvimento:** por padrão a suíte roda no **mesmo banco** do
> `spring-boot:run` (`sono`). Ela só remove contas de teste — e-mail terminando
> em `@example.com`, domínio reservado pela RFC 2606 — e, pelo `ON DELETE
> CASCADE`, os dados ligados a elas; as suas noites reais ficam intactas. Para
> isolar de vez, aponte a suíte para outro banco (crie-o uma vez):
> ```bash
> docker compose exec db psql -U sono -d postgres -c 'CREATE DATABASE sono_sweep OWNER sono;'
> POSTGRES_DB=sono_sweep mvn -B verify
> ```

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

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa, em cada PR: `mvn -B verify` (com PostgreSQL 16 como serviço), `npm ci && npm run typecheck && npm run lint && npm test && npm run build` e um **teste de fumaça E2E** no navegador ([`tools/e2e`](tools/e2e)). **Só faça o merge com tudo verde.**

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
| PUT | `/me` | Atualiza o fuso horário | Bearer |
| DELETE | `/me` | Exclui a conta e todos os dados | Bearer |
| POST | `/sleep-logs` | Registra uma noite (201) | Bearer |
| GET | `/sleep-logs` | Lista: filtros `from`/`to`, paginação `page`/`size` (máx. 100), ordem do mais recente | Bearer |
| PUT | `/sleep-logs/{id}` | Edita uma noite | Bearer |
| DELETE | `/sleep-logs/{id}` | Exclui uma noite | Bearer |
| GET | `/goal` | Meta de sono (cria a padrão se não existir) | Bearer |
| PUT | `/goal` | Atualiza a meta (240–720 min + horários) | Bearer |
| GET | `/stats/summary?days=7\|30` | Média, constância, dívida de sono e série diária | Bearer |

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

Os padrões estão em `backend/src/main/resources/application.yml` e a referência versionada está no [`.env.example`](.env.example).

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
backend/    Java 21 + Spring Boot 3 (API REST)        -> issue #6
frontend/   React + Vite (PWA)                        -> issue #21
docs/       ADRs, identidade visual e documentação
scripts/    Scripts de setup do repositório
```

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

## Setup inicial do repositório (feito na criação do projeto)

Registro histórico de como o repositório foi preparado; útil para recriar em outro projeto.

1. **Crie o repositório** no GitHub (vazio) e envie este kit:
   ```bash
   git init && git add . && git commit -m "chore: kit inicial do projeto"
   git branch -M main
   git remote add origin git@github.com:SEU-USUARIO/NOME-DO-REPO.git
   git push -u origin main
   ```
2. **Crie labels, milestones e as issues** (precisa do [GitHub CLI](https://cli.github.com)):
   ```bash
   gh auth login
   scripts/seed-github.sh --dry-run   # confira o que será criado
   scripts/seed-github.sh             # cria de verdade
   ```
3. **Faça as issues `agente:humano` do M0**: nome/identidade e proteção da `main`.
4. **(Opcional) Ative o `@claude`** nas issues e PRs:
   - Instale o GitHub App do Claude no repositório e crie o segredo `ANTHROPIC_API_KEY` (a forma mais fácil é rodar `/install-github-app` dentro do Claude Code).
   - Comente `@claude implemente esta issue seguindo o AGENTS.md` em uma issue `agente:ok`.
   - Isso consome créditos da API e minutos do GitHub Actions; acompanhe os custos.
5. **Crie um quadro (GitHub Projects)**, opcional: aba *Projects* > *New project* > Board, e adicione as issues. Colunas sugeridas: Backlog, Pronto para fazer, Em andamento, Em revisão, Feito.
6. **Trabalhe em ordem**: M0 → M1 → M2 ... Só avance quando o critério "Pronto quando" do milestone (PLANO.md, seção 7) for cumprido.

## Licença
MIT. Veja [`LICENSE`](LICENSE).
