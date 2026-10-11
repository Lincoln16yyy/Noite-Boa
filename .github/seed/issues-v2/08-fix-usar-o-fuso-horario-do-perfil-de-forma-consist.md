---
title: fix: usar o fuso horário do perfil de forma consistente (ou avisar quando diferir)
labels: tipo:bug,area:frontend,area:backend,prio:p2,agente:revisar
milestone: M7 - Correções e polimento
---
## Contexto
O back-end agrupa estatísticas pelo fuso do perfil (padrão `America/Sao_Paulo`), mas o front completa a série do gráfico com a data do navegador (`lib/dashboard.js`) e mostra o histórico no horário do navegador (commit `dfc79d0`). Se os dois forem diferentes (viagem, perfil nunca ajustado), uma noite pode cair no dia errado. Certeza: **provável**.

## Tarefas
- [ ] Decidir a fonte única (recomendado: fuso do perfil vindo de `GET /me`) e usar nos dias do gráfico e na exibição do histórico, ou ajustar o fuso do perfil na primeira entrada
- [ ] Se o fuso do navegador diferir do perfil, mostrar aviso discreto em Configurações oferecendo atualizar
- [ ] Testes com fusos diferentes (ex.: America/Sao_Paulo e Asia/Tokyo) e virada de dia

## Critérios de aceite
- [ ] Gráfico e histórico coerentes com o fuso do perfil
- [ ] Aviso aparece apenas quando os fusos diferem
- [ ] Testes verdes

## Fora do escopo
Detecção automática contínua de fuso.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
