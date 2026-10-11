# AGENTS.md — Guia para agentes de IA

Este arquivo vale para qualquer agente (Claude, Copilot, Codex, Cursor etc.). Leia **antes** de alterar qualquer coisa.

## Contexto
App de registro e análise de sono. Escopo, arquitetura, modelo de dados e API estão em `PLANO.md` (fonte da verdade). Não contradiga esse arquivo; se precisar mudar uma decisão, proponha na issue.

## Estrutura
```
backend/    Java 21 + Spring Boot 3 + Maven (API REST, Flyway, PostgreSQL)
frontend/   React + Vite (JavaScript)
docs/       ADRs e documentação
.github/    Templates, workflows e issues seed
```

## Como trabalhar
1. Trabalhe **uma issue por vez**. Só pegue issues com label `agente:ok` ou `agente:revisar`. **Nunca** execute `agente:humano`.
2. Leia a issue inteira: contexto, tarefas, critérios de aceite e "Fora do escopo".
3. Crie branch `tipo/NUMERO-slug` (ex.: `feat/14-criar-sleep-log`).
4. Faça o menor conjunto de mudanças que cumpre os critérios de aceite. Não refatore o que não foi pedido.
5. Escreva ou atualize testes junto com o código.
6. Rode as verificações (abaixo) e só abra o PR se passarem.
7. Abra PR usando o template, com `Closes #NUMERO`. Descreva o que mudou e como testar.
8. Se algo estiver ambíguo, **comente na issue com a dúvida** em vez de adivinhar.

## Comandos
```bash
docker compose up -d          # sobe o PostgreSQL local
cd backend && mvn -B verify   # compila, roda testes
cd frontend && npm ci && npm run lint && npm test && npm run build
```
Se um comando ainda não existe (estrutura inicial), diga isso no PR e não invente.

## Convenções
- **Commits:** Conventional Commits em português: `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`, `chore: ...`.
- **Java:** pacotes por funcionalidade (`auth`, `sleep`, `stats`), DTOs separados das entidades, validação com Bean Validation, erros em `ProblemDetail`.
- **Banco:** só alterar o schema via nova migração Flyway (`V<n>__descricao.sql`). Nunca editar migração já commitada.
- **React:** componentes funcionais, chamadas HTTP só pelo cliente de API central, sem lógica de negócio nos componentes.
- **Idioma:** código e nomes técnicos em inglês; textos da interface, docs e mensagens de commit em português (pt-BR).

## Limites (não faça)
- Não adicione dependência nova sem justificar no PR.
- Não commite segredos, tokens, `.env` ou dados reais.
- Não altere `.github/workflows/`, configurações de segurança ou permissões, a menos que a issue peça.
- Não force push na `main`; não faça merge do próprio PR.
- Não apague testes para fazer o CI passar.

## Segurança (checklist rápido)
- Toda rota de dados do usuário filtra pelo usuário autenticado.
- Entrada validada; nada de SQL concatenado.
- Senhas com BCrypt; nunca logar senha, token ou e-mail completo.

## Princípios de trabalho e skills

Leia também `docs/agente/PRINCIPIOS.md`. Para tarefas recorrentes use as skills em `.claude/skills/`:

- `auditar-repositorio`: revisar o código e produzir um relatório com evidências, por gravidade.
- `corrigir-bug`: reproduzir com teste que falha, achar a causa-raiz, corrigir e provar.
- `verificar-visual`: subir o front-end, tirar prints (celular e desktop) e avaliar contra `docs/identidade-visual.md`.

Em PRs que mudam tela, anexe os prints. Em PRs de bug, descreva o teste que falhava antes.
