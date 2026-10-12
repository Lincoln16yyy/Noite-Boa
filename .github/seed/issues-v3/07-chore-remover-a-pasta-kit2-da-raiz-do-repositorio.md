---
title: chore: remover a pasta kit2/ da raiz do repositório
labels: tipo:chore,area:devops,prio:p2,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
A pasta `kit2/` (cópia do kit de apoio, com `AGENTS-adendo.md` e `LEIAME.md`) foi commitada na raiz e duplica arquivos que já existem em `tools/`, `scripts/` e `.claude/` (commit `9087fdb`).

## Tarefas
- [ ] Conferir que tudo que importa de `kit2/` já está no lugar certo (skills, tools, scripts)
- [ ] `git rm -r kit2`
- [ ] Confirmar que o `AGENTS.md` já contém o conteúdo do adendo

## Critérios de aceite
- [ ] Pasta removida
- [ ] Nenhuma referência quebrada (busca por `kit2` no repositório)
- [ ] CI verde

## Fora do escopo
Mudar o conteúdo das skills.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
