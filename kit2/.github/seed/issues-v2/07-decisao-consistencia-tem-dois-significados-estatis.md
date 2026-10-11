---
title: decisão: 'consistência' tem dois significados (estatísticas x ranking)
labels: tipo:chore,area:design,prio:p2,agente:humano
milestone: M7 - Correções e polimento
---
## Contexto
Nas estatísticas, 'Consistência' é a variação do horário de dormir (±min; menor é melhor). No ranking de amigos, 'consistência' é a porcentagem de noites com registro (frequência de registro, não regularidade) (commit `dfc79d0`). O mesmo nome com sentidos diferentes confunde e incentiva registrar por registrar.

## Tarefas
- [ ] Decidir e registrar em `docs/` uma das opções: (a) renomear o ranking para 'Constância' ou 'Noites registradas'; (b) trocar o cálculo do ranking para usar a variação do horário de dormir; (c) manter os dois com nomes distintos
- [ ] Abrir a issue de implementação com o nome e a regra escolhidos, se (b) ou renomeação em vários lugares

## Critérios de aceite
- [ ] Decisão escrita e issue de implementação criada

## Fora do escopo
Implementar a mudança nesta issue.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `auditar-repositorio` (`.claude/skills/auditar-repositorio/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
