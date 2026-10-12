---
title: refactor(frontend): migrar Dashboard, Amigos e Configurações
labels: tipo:chore,area:frontend,prio:p2,agente:revisar
milestone: M8 - Migração para TypeScript
---
## Contexto
Últimas páginas de código, as maiores e com mais chamadas à API (commit `9087fdb`). Regra: **migração não muda comportamento**. Siga a skill `migrar-typescript`.

## Tarefas
- [ ] Migrar as três páginas e testes
- [ ] Respostas da API tipadas pelos tipos gerados (`StatsSummary`, `RankingEntry`, `Friend`...)
- [ ] Confirmar que nenhum campo usado pela tela está ausente no schema; se estiver, abrir issue de back-end em vez de ajustar com `as`

## Critérios de aceite
- [ ] Prints idênticos
- [ ] typecheck, lint, testes e build verdes
- [ ] Lista de campos divergentes (se houver) registrada em issues

## Fora do escopo
Corrigir lógica ou visual.

## Dependências
Depende de Registrar e Histórico em TypeScript.

## Como verificar
Prints antes/depois idênticos.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `migrar-typescript` (`.claude/skills/migrar-typescript/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
