---
title: feat(frontend): dashboard com a identidade da marca (cartão escuro, barras Lavanda/Âmbar)
labels: tipo:feat,area:frontend,area:design,prio:p1,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
O dashboard é a tela que mais mostra valor e hoje é a mais simples: barras todas na cor Noite sobre fundo claro, cartões pequenos e uma coluna estreita no desktop (commit `dfc79d0`). A identidade (`docs/identidade-visual.md`, `docs/brand-board.png`) define cartão escuro com números em Luar e barras Lavanda, com Âmbar para noites abaixo da meta. Atenção: Lavanda e Âmbar **não** têm contraste para gráfico sobre fundo claro; por isso o gráfico vai dentro do cartão Noite.

## Tarefas
- [ ] Cartão principal escuro (Noite) com a média em número grande (Luar, peso 800) e o gráfico semanal dentro
- [ ] Barras Lavanda; barras abaixo da meta em Âmbar; linha da meta tracejada em Luar; rótulos legíveis
- [ ] Métricas de consistência e dívida em cartões com mais destaque (número maior, dica curta)
- [ ] Desktop: duas colunas (resumo e gráfico); celular: uma coluna
- [ ] Manter os estados de carregando, vazio e erro com o mesmo cuidado visual
- [ ] Substituir hex soltos por tokens CSS (`var(--color-...)`) nessa tela

## Critérios de aceite
- [ ] Visual aproximado do exemplo no `brand-board.png`
- [ ] Contraste conferido (documentar valores no PR)
- [ ] Prints mobile e desktop anexados
- [ ] Testes existentes seguem verdes e um teste novo cobre a cor 'abaixo da meta'

## Fora do escopo
Novos gráficos ou novas métricas.

## Como verificar
Prints do dashboard com dados, vazio e erro.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
