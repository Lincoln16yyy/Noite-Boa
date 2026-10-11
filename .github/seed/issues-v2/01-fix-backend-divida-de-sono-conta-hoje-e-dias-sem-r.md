---
title: fix(backend): dívida de sono conta hoje e dias sem registro como 8h
labels: tipo:bug,area:backend,prio:p1,agente:revisar,mvp
milestone: M7 - Correções e polimento
---
## Contexto
Em `StatsService.summary` (linhas ~84-93, commit `dfc79d0`) a dívida soma `meta - dormido` para os últimos 7 dias **incluindo hoje e dias sem nenhum registro**. Consequências: quem dorme das 23h às 7h todo dia nunca zera a dívida (o sono de hoje ainda não aconteceu) e um usuário novo com uma única noite vê cerca de 49h de dívida. O teste `StatsSummaryTest.noDataReturnsZeroedSummary` até afirma `3360` (7×8h) sem nenhum dado. Certeza: **confirmado** pela leitura do código e do teste.

## Tarefas
- [ ] Definir a regra: considerar apenas os dias entre o primeiro registro do usuário (ou hoje−6, o que for mais recente) e **ontem**; incluir hoje só se já houver registro hoje
- [ ] Por dia considerado: `max(0, meta - dormido)`; dias sem registro dentro do intervalo contam como dívida cheia; dias antes do primeiro registro não contam
- [ ] Sem nenhum registro, a dívida é 0
- [ ] Atualizar `noDataReturnsZeroedSummary` para esperar 0 e explicar no PR por que o valor antigo estava errado
- [ ] Documentar a regra em `PLANO.md` (seção das métricas)

## Critérios de aceite
- [ ] Usuário novo com 1 noite de 8h registrada ontem tem dívida 0
- [ ] Usuário que dormiu 8h todas as noites dos últimos 7 dias tem dívida 0 (inclusive à tarde, antes de dormir de novo)
- [ ] Usuário que pulou 2 dias dentro do intervalo tem dívida de 2 × meta
- [ ] Testes cobrem: sem dados, 1 registro, semana perfeita, dias faltando, meta diferente de 8h
- [ ] `mvn -B verify` verde

## Fora do escopo
Mudar a fórmula de média ou de consistência; mudar o rótulo da tela.

## Como verificar
Teste de integração novo para cada cenário; conferir no dashboard simulado (skill `verificar-visual`) que o card 'Dívida de sono' mostra valores plausíveis.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
