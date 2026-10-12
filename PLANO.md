# Plano do Projeto (nome: Noite Boa)

> Documento vivo. Mudou uma decisão? Atualize aqui no mesmo PR. Agentes de IA tratam este arquivo como a fonte da verdade do escopo.

## 1. Visão

**Problema:** muita gente (principalmente estudante) dorme mal, em horários irregulares, e não tem uma forma simples de enxergar o próprio padrão de sono.

**Proposta:** um app web (instalável como PWA) para **registrar o sono, entender o padrão e criar consistência de horários**, com metas simples e estatísticas claras.

**Diferenciais em relação ao projeto original (Meu Soninho):**
- Back-end real (Java/Spring Boot + PostgreSQL) em vez de app 100% estático: contas de usuário e dados na nuvem.
- Foco em **consistência de horário** (o que mais pesa na qualidade do sono), não só em alarme.
- Processo profissional: issues, PRs, CI, testes e documentação desde o dia 1.
- Autoria, nome e identidade visual próprios.

## 2. Escopo

### MVP (o que precisa existir para "lançar")
1. Cadastro e login (e-mail + senha, JWT).
2. Registrar uma noite de sono (início, fim, qualidade 1-5, observação).
3. Histórico com editar e excluir.
4. Dashboard: média de horas (7 e 30 dias), consistência de horário, dívida de sono, gráfico semanal.
5. Meta de sono (horas e horário-alvo).
6. Excluir a própria conta e todos os dados.
7. Deploy público funcionando.

### Pós-MVP (só depois do MVP no ar)
- PWA instalável, lembrete de hora de dormir (melhor esforço), amigos e ranking de noites registradas, sons de relaxamento, avaliação de app nativo para alarme.

### Fora de escopo (por enquanto)
- Integração com wearables, IA/recomendações médicas, pagamentos, app nativo.

## 3. Limitação técnica importante (decidir com honestidade)

**Navegadores não garantem tocar alarme com o celular bloqueado ou o app fechado.** Notificações web têm suporte irregular entre sistemas, principalmente no iOS. Por isso:
- O MVP **não promete alarme confiável**. Entrega registro, estatística e metas.
- Lembretes de dormir entram como "melhor esforço" no pós-MVP.
- Alarme confiável exige app nativo (ex.: Android). Isso vira uma issue de investigação (spike), não uma promessa.

## 4. Arquitetura e stack

```
[ React + Vite (PWA) ]  --HTTPS/JSON-->  [ Spring Boot API ]  --JDBC-->  [ PostgreSQL ]
        frontend/                              backend/                     (Flyway)
```

| Camada | Escolha | Motivo |
|---|---|---|
| Back-end | Java 21 + Spring Boot 3 (Maven) | Alinha com o estudo de Java back-end; muito valorizado em vagas |
| Segurança | Spring Security + JWT, senha com BCrypt | Padrão de mercado |
| Banco | PostgreSQL 16 + Flyway | Migrações versionadas e reproduzíveis |
| Testes back | JUnit 5 + Testcontainers | Testa contra Postgres de verdade |
| Front-end | React + Vite (JavaScript) | Simples de começar; pode migrar para TypeScript depois |
| Gráficos | Recharts | Leve e simples |
| Dev local | Docker Compose (Postgres) | Ambiente igual para todos (inclusive agentes) |
| CI | GitHub Actions | Build + testes em todo PR |
| Hospedagem | A decidir (issue dedicada) | Planos gratuitos mudam; decidir perto do deploy |

Decisões ficam registradas em `docs/ADR-0001-stack.md`.

## 5. Modelo de dados (v1)

- **users**: `id uuid PK`, `email unique`, `password_hash`, `display_name`, `timezone` (padrão `America/Sao_Paulo`), `created_at`
- **sleep_logs**: `id uuid PK`, `user_id FK`, `sleep_start timestamptz`, `sleep_end timestamptz`, `quality smallint (1-5)`, `notes text null`, `created_at`, `updated_at`
  - `CHECK (sleep_end > sleep_start)`; índice `(user_id, sleep_start DESC)`
- **sleep_goals**: `user_id PK/FK`, `target_minutes int`, `bedtime time`, `wake_time time`, `updated_at`

Horários sempre em UTC no banco; conversão pelo `timezone` do usuário na hora de agrupar por dia.

**Definições das métricas (para ninguém inventar diferente):**
- *Média de horas*: média da duração das noites no período (7 ou 30 dias).
- *Consistência*: desvio padrão do horário de dormir no período (menor = melhor).
- *Dívida de sono*: soma de (meta diária − dormido) nos últimos 7 dias, mínimo 0. Só conta a partir do primeiro registro do usuário no **histórico** (não da janela consultada): quem nunca registrou não tem dívida; dias sem registro dentro da janela contam como dívida cheia.

## 6. API (v1)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Cria conta | não |
| POST | `/api/auth/login` | Retorna JWT | não |
| GET | `/api/me` | Dados do usuário logado | sim |
| DELETE | `/api/me` | Exclui conta e dados | sim |
| POST | `/api/sleep-logs` | Registra noite | sim |
| GET | `/api/sleep-logs?from=&to=&page=` | Lista paginada | sim |
| PUT | `/api/sleep-logs/{id}` | Edita (só dono) | sim |
| DELETE | `/api/sleep-logs/{id}` | Exclui (só dono) | sim |
| GET | `/api/stats/summary?days=7` | Métricas | sim |
| GET/PUT | `/api/goal` | Meta de sono | sim |

Erros seguem RFC 7807 (`ProblemDetail`). Documentação interativa via OpenAPI/Swagger.

## 7. Roadmap (milestones no GitHub)

| Milestone | Objetivo | Pronto quando |
|---|---|---|
| M0 - Fundação | Repo, estrutura, CI, ambiente local | `docker compose up` sobe o banco e o CI roda verde |
| M1 - Back-end base e autenticação | Conta e login | Cadastro/login/`/api/me` funcionando com testes |
| M2 - Registro de sono (API) | CRUD de sono | Todos os endpoints de `sleep-logs` testados |
| M3 - Front-end MVP | Telas principais | Dá para criar conta, logar, registrar e ver histórico |
| M4 - Estatísticas e metas | Valor do produto | Dashboard e metas funcionando |
| M5 - Deploy e qualidade | Publicar | App público, docs e exclusão de conta |
| M6 - Pós-MVP | Evolução | Itens escolhidos depois do lançamento |

## 8. Fluxo de trabalho com GitHub e agentes de IA

**Princípio: tudo vira issue; todo código entra por PR; humano aprova.**

1. **Issues** são a unidade de trabalho (uma issue = um PR). Já vêm prontas com contexto, tarefas e critérios de aceite em `.github/seed/issues/`.
2. **Labels** organizam e controlam o que agente pode fazer:
   - `agente:ok` — issue segura para um agente de IA executar sozinho.
   - `agente:revisar` — agente pode fazer, mas exige revisão atenta (segurança, dados).
   - `agente:humano` — decisão ou configuração que só o dono faz (settings, segredos, nome).
   - `tipo:*`, `area:*`, `prio:*`, `mvp` / `pos-mvp`.
3. **Milestones** = marcos do roadmap acima.
4. **Pull Requests** com template, `Closes #N`, CI obrigatório e revisão humana.
5. **`@claude` em issues e PRs** (opcional): o workflow `claude.yml` permite pedir "@claude implemente esta issue". Só roda para o dono do repositório e exige o segredo `ANTHROPIC_API_KEY`. Isso consome crédito da API e minutos do GitHub Actions.
6. **`AGENTS.md`** (e `CLAUDE.md`) diz a qualquer agente como trabalhar neste repo: comandos, convenções, limites.
7. **Dependabot** abre PRs de atualização de dependências automaticamente.
8. **GitHub Projects** (quadro kanban) é opcional: criar manualmente e adicionar as issues; colunas Backlog, Pronto para fazer, Em andamento, Em revisão, Feito.

**Regras de ouro para agentes:** uma issue por vez; não ampliar escopo; testes junto com o código; nunca mexer em segredos; dúvida = comentar na issue, não adivinhar.

## 9. Qualidade

**Definição de pronto (DoD) para qualquer PR:**
- Critérios de aceite da issue atendidos.
- Testes novos/atualizados passando (`mvn verify`, `npm test`).
- CI verde.
- Sem segredos no código.
- Documentação atualizada se mudou comportamento, rota ou setup.

**Estratégia de testes:** back-end com testes de integração (Testcontainers) para auth e sleep-logs; regras de estatística com testes unitários; front-end com testes de componentes nas telas críticas (Vitest + Testing Library).

## 10. Segurança e privacidade

- Dados de sono podem ser tratados como dados pessoais ligados à saúde; coletar o mínimo necessário.
- Usuário pode excluir conta e todos os dados (issue no M5).
- Senhas só com BCrypt; JWT com expiração curta; segredos em variáveis de ambiente, nunca no Git.
- Limite de tentativas em login e cadastro, em memória por IP (+ e-mail no login), respondendo 429 com `Retry-After`; limites configuráveis por variável de ambiente. A Render não limpa o `X-Forwarded-For` vindo do cliente, então o IP confiável vem de `CF-Connecting-IP` (posto pela Cloudflare), com um teto por e-mail independente do IP (issue #155).
- Validação de entrada em toda rota; verificação de dono em todo recurso de sono.
- CORS restrito ao domínio do front-end.
- Política de privacidade simples antes de abrir ao público (conferir com orientação adequada, não sou advogado).

## 11. Riscos e decisões em aberto

| Item | Plano |
|---|---|
| Escopo crescer demais | MVP fechado; tudo novo vai para M6 |
| Alarme não funcionar no navegador | Documentado na seção 3; spike no M6 |
| Custo de hospedagem do back-end | Decidir hospedagem só no M5, comparando opções vigentes na época |
| Uso de agentes gerar código ruim | Issues pequenas, testes, CI e revisão humana obrigatória |
| Nome já usado | Checar domínio, lojas e INPI antes de fixar |

**Sugestões de nome** (escolher e checar disponibilidade): Soneca, Ninho, Repouso, Sonhei, Aurora, Pausa, Cochilo, Lua Nova.

## 12. Ordem de ataque sugerida

1. Criar o repositório com este kit e rodar `scripts/seed-github.sh`.
2. Fazer as issues `agente:humano` do M0 (nome, proteção da branch, segredo da API).
3. Deixar agentes (ou você) pegarem as issues `agente:ok` do M0 e M1 em ordem.
4. Só passar de milestone quando o critério "Pronto quando" da tabela da seção 7 estiver cumprido.
