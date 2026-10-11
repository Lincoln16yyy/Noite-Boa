---
title: fix(frontend): respostas atrasadas podem sobrescrever o período escolhido no dashboard
labels: tipo:bug,area:frontend,prio:p2,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
`Dashboard.jsx` dispara `load(days)` a cada troca de período sem cancelar a requisição anterior (commit `dfc79d0`). Alternando rápido entre 7 e 30 dias, a resposta antiga pode chegar depois e exibir dados do período errado sob o botão selecionado. O mesmo padrão pode existir em Histórico e Amigos. Certeza: **provável** (condição de corrida clássica; falta reproduzir em teste).

## Tarefas
- [ ] Escrever teste que reproduz: duas chamadas com respostas fora de ordem
- [ ] Permitir `signal` (AbortController) em `api.get/post/put/delete` e usar no efeito, ignorando respostas de execuções antigas
- [ ] Aplicar o mesmo padrão em Histórico (troca de página) e Amigos (troca de período do ranking)

## Critérios de aceite
- [ ] Teste de resposta fora de ordem passa
- [ ] A tela sempre reflete o último período escolhido
- [ ] `npm run lint && npm test && npm run build` verdes

## Fora do escopo
Biblioteca de cache de dados (React Query etc.).

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
