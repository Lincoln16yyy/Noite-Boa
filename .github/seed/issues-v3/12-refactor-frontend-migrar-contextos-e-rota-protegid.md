---
title: refactor(frontend): migrar contextos e rota protegida (Auth, Theme, ProtectedRoute)
labels: tipo:chore,area:frontend,prio:p1,agente:revisar
milestone: M8 - Migração para TypeScript
---
## Contexto
O estado de sessão é o ponto mais sensível do front (o bug do login nasceu aqui) (commit `9087fdb`). Tipos ajudam a deixar explícito `user: User | null` e o estado de carregamento. Regra: **migração não muda comportamento**. Siga a skill `migrar-typescript`.

## Tarefas
- [ ] Migrar `AuthContext`, `ThemeContext`, `ProtectedRoute` e hooks (`useAuth`, `useTheme`)
- [ ] `AuthContextValue` com `user: User | null`, `loading`, `login(token)`, `logout()`, `refreshUser()`; `useAuth` que lança erro claro fora do provider
- [ ] Tema como união `'light' | 'dark' | 'auto'`
- [ ] Migrar `test-utils` e os testes da fatia

## Critérios de aceite
- [ ] Comportamento idêntico (inclusive o teste E2E de login)
- [ ] typecheck, lint, testes e build verdes

## Fora do escopo
Alterar a lógica de sessão.

## Dependências
Depende de lib/ e api/client em TypeScript.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `migrar-typescript` (`.claude/skills/migrar-typescript/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
