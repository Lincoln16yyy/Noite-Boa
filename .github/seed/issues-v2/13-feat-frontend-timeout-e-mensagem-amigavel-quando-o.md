---
title: feat(frontend): timeout e mensagem amigável quando o servidor está acordando
labels: tipo:feat,area:frontend,prio:p1,agente:ok,mvp
milestone: M7 - Correções e polimento
---
## Contexto
O servidor gratuito da Render dorme quando fica sem uso; o primeiro acesso pode demorar bastante. O cliente de API não tem timeout e erro de rede aparece como 'Failed to fetch', em inglês (commit `dfc79d0`).

## Tarefas
- [ ] Em `api/client.js`: timeout configurável (padrão 30 s) com AbortController e mensagem em português quando a rede falhar ou o tempo esgotar
- [ ] Depois de ~4 s carregando, mostrar 'Acordando o servidor… isso pode levar alguns segundos' (componente reutilizável)
- [ ] Botão 'Tentar novamente' onde ainda não existir
- [ ] Testes: timeout, erro de rede, aviso de demora (timers falsos)

## Critérios de aceite
- [ ] Nenhuma tela mostra 'Failed to fetch' ao usuário
- [ ] Aviso aparece no carregamento lento
- [ ] Testes verdes

## Fora do escopo
Manter o servidor acordado com pings.

## Como verificar
Print do estado 'acordando' no dashboard (simule resposta lenta no mock).

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
