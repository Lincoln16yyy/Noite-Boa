---
title: refactor(frontend): migrar lib/ e api/client para TypeScript
labels: tipo:chore,area:frontend,prio:p1,agente:ok
milestone: M8 - Migração para TypeScript
---
## Contexto
Folhas da árvore: funções puras sem React, com testes, ideais para começar (commit `9087fdb`). Regra: **migração não muda comportamento**. Siga a skill `migrar-typescript`.

## Tarefas
- [ ] Migrar `src/lib/*` (sleep, dashboard, fuso e demais) e `src/api/client` com `git mv` num commit separado
- [ ] Tipar parâmetros e retornos; `api.get/post/put/delete` genéricos (`api.get<StatsSummary>(...)`) usando `types.ts`
- [ ] Erros da API tipados (formato `ProblemDetail`)
- [ ] Migrar os testes dessa fatia para `.test.ts` na mesma PR

## Critérios de aceite
- [ ] Nenhum `any` sem comentário
- [ ] Testes da fatia passam sem alteração de comportamento
- [ ] typecheck, lint, testes e build verdes

## Fora do escopo
Migrar contextos, componentes ou páginas.

## Dependências
Depende da issue de tipos da API.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `migrar-typescript` (`.claude/skills/migrar-typescript/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
