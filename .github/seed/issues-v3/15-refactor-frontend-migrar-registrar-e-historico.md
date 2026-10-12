---
title: refactor(frontend): migrar Registrar e Histórico
labels: tipo:chore,area:frontend,prio:p2,agente:ok
milestone: M8 - Migração para TypeScript
---
## Contexto
Telas de registro de sono, com datas e fuso, onde tipos evitam trocar strings de data por objetos (commit `9087fdb`). Regra: **migração não muda comportamento**. Siga a skill `migrar-typescript`.

## Tarefas
- [ ] Migrar as duas páginas e testes
- [ ] Tipar datas ISO e valores de `datetime-local` de forma distinta (tipos nomeados)
- [ ] Nota 1 a 5 como união `1 | 2 | 3 | 4 | 5`

## Critérios de aceite
- [ ] Prints idênticos
- [ ] Testes de fuso passam em UTC e em America/Sao_Paulo
- [ ] typecheck, lint, testes e build verdes

## Fora do escopo
Mudar regras de validação.

## Dependências
Depende das páginas simples em TypeScript.

## Como verificar
Prints antes/depois idênticos.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `migrar-typescript` (`.claude/skills/migrar-typescript/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
