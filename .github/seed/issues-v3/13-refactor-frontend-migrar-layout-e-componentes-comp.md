---
title: refactor(frontend): migrar Layout e componentes compartilhados
labels: tipo:chore,area:frontend,prio:p2,agente:ok
milestone: M8 - Migração para TypeScript
---
## Contexto
Layout, SleepChart e demais componentes de `src/components` (commit `9087fdb`). Regra: **migração não muda comportamento**. Siga a skill `migrar-typescript`.

## Tarefas
- [ ] Migrar com `git mv` separado; props com `interface` explícita
- [ ] Eventos e refs tipados (sem `any`)
- [ ] Migrar os testes dessa fatia

## Critérios de aceite
- [ ] Prints idênticos aos de antes (skill `verificar-visual`)
- [ ] typecheck, lint, testes e build verdes

## Fora do escopo
Corrigir o layout (issues de navegação).

## Dependências
Depende dos contextos em TypeScript. Fazer depois da correção da navegação duplicada, para evitar conflito no `Layout`.

## Como verificar
Prints antes/depois idênticos.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `migrar-typescript` (`.claude/skills/migrar-typescript/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
