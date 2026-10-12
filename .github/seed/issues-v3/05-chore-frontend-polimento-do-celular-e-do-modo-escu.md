---
title: chore(frontend): polimento do celular e do modo escuro (nota, tema, pílulas, cartão)
labels: tipo:chore,area:frontend,area:design,prio:p2,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
Pequenos defeitos vistos nos prints (commit `9087fdb`): (1) o seletor de nota quebra em 4 + 1 opções no celular; (2) as pílulas 'Escuro' e 'Automático' do tema quebram o texto; (3) no modo escuro a pílula '30 dias' fica branca e o cartão escuro do dashboard some contra o fundo, sem borda; (4) o rótulo 'Meta 8h' do gráfico encosta na última barra; (5) no desktop o dashboard ocupa só cerca de dois terços da largura.

## Tarefas
- [ ] Nota: cinco opções em uma linha (grade de 5 colunas ou rolagem horizontal), mantendo rótulos legíveis
- [ ] Pílulas do tema com largura suficiente (ícone e texto sem quebrar)
- [ ] Modo escuro: pílula inativa com as cores do tema, cartão do dashboard com borda/elevação sutil
- [ ] Mover o rótulo da meta para fora da área das barras
- [ ] Desktop: dashboard em duas colunas (resumo e gráfico) como pedia a issue original

## Critérios de aceite
- [ ] Prints de celular (claro e escuro) e desktop sem os defeitos listados
- [ ] Contraste dos pares usados conferido
- [ ] Testes seguem verdes

## Fora do escopo
Novas funcionalidades de gráfico.

## Como verificar
Prints claro/escuro, 390 px e 1280 px.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
