---
title: test: teste de fumaça E2E (login, sessão, registrar, sair) no CI
labels: tipo:test,area:frontend,area:devops,prio:p1,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
Os piores problemas recentes (login que não entrava, modo escuro ilegível) passaram pelos testes unitários porque são problemas de integração (commit `9087fdb`). Um teste de fumaça rápido no navegador pega esse tipo de falha.

## Tarefas
- [ ] Criar `tools/e2e/smoke.mjs` a partir do `e2e-login.mjs` do kit anterior: sobe o app compilado (`vite preview`) com a API simulada que exige `Authorization` (como o back-end real)
- [ ] Cenários: visitante vê Entrar; login correto vai para `/dashboard`; recarregar mantém a sessão; registrar uma noite; sair volta ao início; modo escuro mantém texto legível (checagem simples de contraste)
- [ ] Job novo no CI depois do build, usando o Chrome disponível no runner (confirmar o caminho no runner)
- [ ] Documentar como rodar localmente

## Critérios de aceite
- [ ] Teste falha se o login deixar o usuário em `/login`
- [ ] Roda no CI em menos de 2 minutos
- [ ] Documentado

## Fora do escopo
Testar contra o back-end real.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
