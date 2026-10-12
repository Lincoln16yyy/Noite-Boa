---
title: fix(backend): dívida de sono ignora dias anteriores à janela ao achar o primeiro registro
labels: tipo:bug,area:backend,prio:p2,agente:revisar
milestone: M7 - Correções e polimento
---
## Contexto
Em `StatsService.doSummary` o `firstSleepDate` é calculado só entre os registros da janela consultada (`days`), não sobre o histórico do usuário (commit `9087fdb`). Quem tem histórico antigo mas ficou vários dias sem registrar tem dívida **subcontada**: os dias sem registro antes do primeiro registro da janela não entram. Certeza: **provável** (depende de como se define 'primeiro registro').

## Tarefas
- [ ] Decidir e documentar a regra (recomendado: primeiro registro do usuário no histórico, não da janela), usando consulta barata (data mínima por usuário)
- [ ] Testes: usuário com histórico antigo e 5 dias sem registro dentro dos últimos 7; usuário novo; usuário sem registros
- [ ] Atualizar a definição em `PLANO.md`

## Critérios de aceite
- [ ] Caso do histórico antigo conta os dias sem registro
- [ ] Usuário novo continua sem dívida artificial
- [ ] `mvn -B verify` verde

## Fora do escopo
Mudar a fórmula de média ou consistência.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
